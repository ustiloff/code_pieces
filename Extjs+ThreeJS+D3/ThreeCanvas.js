Ext.define('Dronelyzer.view.three.ThreeCanvas', {
  extend: 'Ext.Widget',

  xtype: 'threecanvas',

  ANIM_ITERATIONS: 40,

  config: {
    pointSize: 0.05,
    autoRotate: true,
    squelchLevel: null, //squelch in pixels (noisedB + squelch)
    FFTData: null // {rawData: <array>, fftWindow: 256, height: 1024}
  },

  element: {
    reference: 'element'
  },

  updateSquelchLevel: function (newVal, oldVal) {
    var me = this;
    if (oldVal) {
      me.oldSquelchLevel = oldVal;
    }
    if (newVal && !me.squelchPlane) {
      var geometry = new THREE.PlaneBufferGeometry( 1, 1 );
      var material = new THREE.MeshBasicMaterial( {
        color: 0xDC26FC,
        side: THREE.DoubleSide,
        opacity: 0.5,
        transparent: true,
      } );
      me.squelchPlane = new THREE.Mesh( geometry, material );
      me.squelchPlane.scale.set( 4, 10, 0 );
      me.squelchPlane.position.set( 0, newVal / 255 * 10, 0 );
      me.squelchPlane.rotateX( Math.PI / 2 );
      me.scene.add( me.squelchPlane );
    }
  },

  updateFFTData: function (newVal, oldVal) {
    var me = this;
    if (newVal) {
      var fftData = newVal;
      var converter = new Dronelyzer.FFT.PowerPixelsConverter(+fftData.fftWindow, +fftData.fftGain, +fftData.fftShift, +fftData.gain);
      var noiseDb = converter.toDB(+fftData.noiseLevel);
      var squelchDb = +noiseDb + (+fftData.squelch);
      var squelchPx = converter.fromDB(+squelchDb);
      me.setSquelchLevel(squelchPx);
    }
    if (newVal && !oldVal) {
      me.drawChart(newVal);
    } else if (newVal && oldVal) {
      me.oldData = oldVal.rawData;
      me.animIteration = 0;
    } else {
      me.clearScene();
    }
  },

  generatePointCloudGeometry: function (data) {
    var geometry = new THREE.BufferGeometry();
    var attr = this.makeAttributesFromData(data);
    geometry.setAttribute( 'position', new THREE.BufferAttribute( attr.positions, 3 ) );
    geometry.setAttribute( 'color', new THREE.BufferAttribute( attr.colors, 3 ) );
    geometry.computeBoundingBox();
    return geometry;
  },

  makeAttributesFromData: function (dataObj) {
    var data = dataObj.rawData,
      width = dataObj.fftWindow,
      length = dataObj.height;
    var numPoints = width * length;
    var positions = new Float32Array( numPoints * 3 );
    var colors = new Float32Array( numPoints * 3 );
    var k = 0;
    for ( var i = 0; i < width; i ++ ) {
      for ( var j = 0; j < length; j ++ ) {
        var x = i / width - 0.5;
        var y = data[j * width + i] / (255);
        var z = j / length - 0.5;
        positions[ 3 * k ] = x;
        positions[ 3 * k + 1 ] = y;
        positions[ 3 * k + 2 ] = z;
        // var intensity = ( y + 0.1 ) * 5;
        var intensity = 1;
        var colorArr = Dronelyzer.FFT.palette[data[j * width + i]];
        colors[ 3 * k ] = colorArr[0] / 255 * intensity;
        colors[ 3 * k + 1 ] = colorArr[1] / 255 * intensity;
        colors[ 3 * k + 2 ] = colorArr[2] / 255 * intensity;
        k++;
      }
    }
    return {
      positions: positions,
      colors: colors
    };
  },

  generatePointcloud: function (data) {
    var me = this;
    var geometry = me.generatePointCloudGeometry(data);
    var material = new THREE.PointsMaterial( { size: me.getPointSize(), vertexColors: true } );
    return new THREE.Points( geometry, material );
  },

  drawChart: function (data) {
    var me = this;
    if (!me.pcBuffer) {
      me.pcBuffer = me.generatePointcloud(data);
      me.pcBuffer.scale.set( 4, 10, 10 );
      me.scene.add(me.pcBuffer);
    }
   else {
     var attr = me.makeAttributesFromData(data);
      me.pcBuffer.geometry.attributes.position = attr.positions;
      me.pcBuffer.geometry.attributes.color = attr.colors;
      me.pcBuffer.geometry.attributes.position.needsUpdate = true;
      me.pcBuffer.geometry.attributes.color.needsUpdate = true;
    }
  },

  onElementResize: function(element, size) {
    this.handleResize(size);
  },

  destroy: function() {
    var me = this;

    me.clearScene();

    me.controls.dispose();
    me.renderer.dispose();
    me.camera.dispose();
    me.scene.dispose();

    if (me.hasListeners.destroy) {
      me.fireEvent('destroy', me);
    }

    me.callParent();
  },

  handleResize: function (size) {
    var me = this,
      el = me.element;

    size = size || (el && el.getSize());

    if (!(size && size.width && size.height)) {
      return;
    }
    me.camera.aspect = size.width / size.height;
		me.camera.updateProjectionMatrix();

		me.renderer.setSize( size.width, size.height );
  },

  constructor: function(config) {
    var me = this;
    me.callParent([config]);
    me.on('resize', 'onElementResize', me);

    me.scene = new THREE.Scene();
    me.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
		me.camera.position.set( 10, 10, 10 );
    me.scene.position.set(0, -3, 0);
		me.camera.lookAt( me.scene.position );
		me.camera.updateMatrix();

    me.renderer = new THREE.WebGLRenderer( { antialias: true } );
		me.renderer.setPixelRatio( window.devicePixelRatio );
    me.renderer.setSize( 100, 100 );
    me.getEl().dom.appendChild( me.renderer.domElement );

    me.controls = new THREE.OrbitControls( me.camera, me.renderer.domElement );
    me.controls.maxPolarAngle = Math.PI * 0.5;
    me.controls.minDistance = 1;
    me.controls.maxDistance = 100;

    me.mouse = new THREE.Vector2();
    me.rotateY = new THREE.Matrix4().makeRotationY( 0.005 );

    function animate() {
      requestAnimationFrame(animate);
      if (me.getConfig('autoRotate')) {
        me.camera.applyMatrix4( me.rotateY );
        me.camera.updateMatrixWorld();
      }
      if (me.oldData && me.animIteration < me.ANIM_ITERATIONS) {
        var position = me.pcBuffer.geometry.attributes.position.array;
        var color = me.pcBuffer.geometry.attributes.color.array;
        var width = me.getFFTData().fftWindow,
          length = me.getFFTData().height,
          newData = me.getFFTData().rawData;
        var oldY, newY, step, y, colorArr, intensity;
        var k = 0;
        for ( var i = 0; i < width; i ++ ) {
          for ( var j = 0; j < length; j ++ ) {
            oldY = me.oldData[j * width + i];
            newY = newData[j * width + i];
            step = (newY - oldY) / me.ANIM_ITERATIONS;
            y = oldY + step * (me.animIteration + 1);
            position[3 * k + 1] = y / 255;
            intensity = 1;
            colorArr = Dronelyzer.FFT.palette[Math.floor(y)];
            color[ 3 * k ] = colorArr[0] / 255 * intensity;
            color[ 3 * k + 1 ] = colorArr[1] / 255 * intensity;
            color[ 3 * k + 2 ] = colorArr[2] / 255 * intensity;
            k++;
          }
        }
        if (me.oldSquelchLevel && me.squelchPlane) {
          var curPosition = me.squelchPlane.position.y;
          if ( curPosition != me.getSquelchLevel() / 255 ) {
            step = (me.getSquelchLevel() - me.oldSquelchLevel) / me.ANIM_ITERATIONS;
            var newPosition = (me.oldSquelchLevel + step * (me.animIteration + 1)) / 255 * 10; // - 3
            me.squelchPlane.position.set(0, newPosition, 0);
          }
        }
        me.animIteration++;
        me.pcBuffer.geometry.attributes.position.needsUpdate = true;
        me.pcBuffer.geometry.attributes.color.needsUpdate = true;
        me.squelchPlane.geometry.attributes.position.needsUpdate = true;
      }
      me.renderer.render(me.scene, me.camera);
    }
    animate();
  },

  disposeNode: function (node) {
    var me = this;
    for (var i = node.children.length - 1; i >= 0; i--) {
      me.disposeNode(node.children[i]);
    }
    if (node instanceof THREE.Mesh) {
      if (node.geometry){
        node.geometry.dispose ();
      }
      if (node.material) {
        if (node.material instanceof THREE.MeshFaceMaterial) {
          node.material.materials.forEach((mtrl) => {
            if (mtrl.map)               mtrl.map.dispose();
            if (mtrl.lightMap)          mtrl.lightMap.dispose();
            if (mtrl.bumpMap)           mtrl.bumpMap.dispose();
            if (mtrl.normalMap)         mtrl.normalMap.dispose();
            if (mtrl.specularMap)       mtrl.specularMap.dispose();
            if (mtrl.envMap)            mtrl.envMap.dispose();
            if (mtrl.alphaMap)          mtrl.alphaMap.dispose();
            if (mtrl.aoMap)             mtrl.aoMap.dispose();
            if (mtrl.displacementMap)   mtrl.displacementMap.dispose();
            if (mtrl.emissiveMap)       mtrl.emissiveMap.dispose();
            if (mtrl.gradientMap)       mtrl.gradientMap.dispose();
            if (mtrl.metalnessMap)      mtrl.metalnessMap.dispose();
            if (mtrl.roughnessMap)      mtrl.roughnessMap.dispose();
            mtrl.dispose ();    // disposes any programs associated with the material
          });
        }
        else {
          if (node.material.map)              node.material.map.dispose ();
          if (node.material.lightMap)         node.material.lightMap.dispose ();
          if (node.material.bumpMap)          node.material.bumpMap.dispose ();
          if (node.material.normalMap)        node.material.normalMap.dispose ();
          if (node.material.specularMap)      node.material.specularMap.dispose ();
          if (node.material.envMap)           node.material.envMap.dispose ();
          if (node.material.alphaMap)         node.material.alphaMap.dispose();
          if (node.material.aoMap)            node.material.aoMap.dispose();
          if (node.material.displacementMap)  node.material.displacementMap.dispose();
          if (node.material.emissiveMap)      node.material.emissiveMap.dispose();
          if (node.material.gradientMap)      node.material.gradientMap.dispose();
          if (node.material.metalnessMap)     node.material.metalnessMap.dispose();
          if (node.material.roughnessMap)     node.material.roughnessMap.dispose();
          node.material.dispose ();   // disposes any programs associated with the material
        }
      }
      node.dispose();
    }
  },

  clearNode: function (node) {
    var me = this;
    for (var i = node.children.length - 1; i >= 0; i--){
      me.clearNode(node.children[i]);
      node.remove(node.children[i]);
    }
  },

  clearScene: function () {
    var me = this;
    for (var i = 0; i < me.scene.children.length; i++) {
      me.disposeNode(me.scene.children[i]);
      me.clearNode(me.scene.children[i]);
      me.scene.remove(me.scene.children[i]);
    }
  }
});
