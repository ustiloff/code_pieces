Ext.define('Dronelyzer.view.panorama.PanoramaTile', {
  extend: 'Ext.d3.svg.Svg',
  xtype: 'panoramatile',

  requires: [
    'Ext.d3.svg.Svg'
  ],

  config: {
    locator: 'plastone',
    startTime: null,
    scanUrl: null,
    timeScaleWidth: 40,
    pps: 2,
    rectHeight: 2,
    scanTickSize: 2,
    tileSize: 1000 * 60 * 60,// milliseconds, one hour by default
    store: null,
    fqs: [],
    fqWidth: Dronelyzer.FFT.INPUT_RATE,
    holdResize: false,
    maxFqsCount: 0
  },

  bubbleEvents: ['resizetile'],

  updateMaxFqsCount: function (newVal) {
    if (!newVal) {
      return;
    }
    var me = this;
    me.resizeTile();
  },

  updateHoldResize: function (newVal, oldVal) {
    var me = this;
    if (oldVal === undefined) {
      return;
    }
    if (!newVal) {
      var maxFqs = 0;
      Ext.getStore('ScanHistory').each((item)=>{
        maxFqs = Math.max(me.getMaxFqsCount(), item.get('fqs').length);
      });
      if (maxFqs > me.getMaxFqsCount()) {
        me.setMaxFqsCount(maxFqs);
      } else {
        me.resizeTile();
      }
    }
  },

  constructor: function(config) {
    var me = this;
    me.callParent(arguments);
    me.initConfig(config);
    me.configChanges = [];
    me.bufferDetects = [];
    me.lastScanHeight = me.getRectHeight() * 1.5;
    me.gFqLines = me.getSvg().append('g');
    me.gScans = me.getSvg().append('g');
    me.gDetects = me.getSvg().append('g');
    me.gWarnings = me.getSvg().append('g');
    me.gAnomalies = me.getSvg().append('g');
    var maxFqs = 0;
    Ext.getStore('ScanHistory').each((item)=>{
      maxFqs = Math.max(maxFqs, item.get('fqs').length);
    });
    me.setMaxFqsCount(maxFqs);
    me.tileWorker = new Worker('lib/worker/tileworker.js?ver=' + Dronelyzer.appVersion);
    var laStore = Ext.getStore('LocatorActivity'),
      laRec = laStore.getById(me.getConfig('locator')),
      lmStore = Ext.getStore('LogMessages');
    me.tileWorker.onmessage = function (msg) {
      me.isLoading = false;
      try {
        if (msg.data.error) {
            console.log('hourly log file load failed: %o', msg.data.error);
            laStore.fireEventArgs('loaderror', [laRec]);
            me.fireEvent('loaderror');
            return;
        }
        if (msg.data.scanHistory && msg.data.scanHistory.length > 0) {
          var shStore = Ext.getStore('ScanHistory');
          msg.data.scanHistory.forEach((item) => {
            if (!shStore.getById(item.scanId)) {
              shStore.add(item);
            }
          });
        }
        if (msg.data.scans) {
          var sStore = Ext.getStore('Scans'),
          toAdd = [];
          msg.data.scans.forEach((scan)=>{
            var sRec = sStore.getById(scan.id);
            if (!sRec) {
              // sStore.add(scan);
              toAdd.push(scan);
            } else {
              sRec.set('data', sRec.get('data').concat(scan.data));
            }
          });
          if (toAdd.length > 0) {
            sStore.on('add', me.onScanAdd, me, {single: true});
            sStore.add(toAdd);
          }
        }
        if (msg.data.detects && msg.data.detects.length > 0) {
          var prepared = msg.data.detects.map((rec)=>me.prepareDataForPanorama(rec));
          me.drawPanoramaFromData(prepared);

          var insertAt = 0;
          if (lmStore.last() && +msg.data.detects[0].remoteTime <= +lmStore.last().get('remoteTime')) {
            insertAt = lmStore.indexOf(lmStore.last());
            insertAt++;
          } else if (lmStore.first() && +msg.data.detects[0].remoteTime <= +lmStore.first().get('remoteTime')) {
            insertAt = lmStore.findBy(function(r){
              return +r.get('remoteTime') <= +msg.data.detects[0].remoteTime;
            });
          }
          msg.data.detects.sort((a,z)=>+z.remoteTime - +a.remoteTime);
          lmStore.insert(insertAt, msg.data.detects);
        }

        var locator = me.getLocator();

        if (!Dronelyzer.FFT.data[locator]) {
          Dronelyzer.FFT.data[locator] = {};
        }
        if (msg.data.fftData) {
          Object.keys(msg.data.fftData).forEach(function(fq){
            if (!Dronelyzer.FFT.data[locator].last || +Dronelyzer.FFT.data[locator].last < +msg.data.fftData[fq].last) {
              Dronelyzer.FFT.data[locator].last = msg.data.fftData[fq].last;
            }
            if (!Dronelyzer.FFT.data[locator][fq]) {
              Dronelyzer.FFT.data[locator][fq] = {last: msg.data.fftData[fq].last};
            } else if (!Dronelyzer.FFT.data[locator][fq].last || +Dronelyzer.FFT.data[locator][fq].last < +msg.data.fftData[fq].last) {
              Dronelyzer.FFT.data[locator][fq].last = msg.data.fftData[fq].last;
            }
          });
        }
        me.isLoaded = true;
        me.fireEvent('load');
      } catch (e) {
        me.fireEvent('loaderror');
        console.log('error on tile worker: %o', e);
      }
    }
    me.initScene();
  },

  drawDataInGroup: function (group, data) {
    var me = this;
    group.selectAll()
      .data(data)
      .enter()
      .append('rect')
      .attr('fill', function (d) {
          return d.fillStyle;
      })
      .attr('x', function (d) {
          return d.x;
      })
      .attr('y', function (d) {
          return d.y;
      })
      .attr('width', function (d) {
          return d.width;
      })
      .attr('height', function (d) {
          return d.height;
      })
      .attr('recId', function (d) {
          return d.recId;
      })
      .classed('anomaly', function (d) {
        return d.anomaly === 'anomaly';
      })
      .classed('warning', function (d) {
        return d.anomaly === 'warning';
      })
      .classed('noise', function (d) {
        return d.isNoise;
      })
      .classed('incomplete', function (d) {
        return d.forAdmin;
      })
      .on('click', function (rect) {
        me.fireEventArgs('detectclick', [rect.recId]);
      })
      .on('mouseover', function (rect) {
        me.fireEventArgs('detectmouseover', [rect.recId]);
      })
      .on('mouseout', function (rect) {
        me.fireEventArgs('detectmouseout', [rect.recId]);
      });
  },

  drawPanoramaFromData: function (data) {
    var me = this;

    data.sort((a,b)=>b.weight - a.weight);

    me.drawDataInGroup(me.gDetects, data.filter((item)=>!item.anomaly));
    me.drawDataInGroup(me.gWarnings, data.filter((item)=>item.anomaly === 'warning'));
    me.drawDataInGroup(me.gAnomalies, data.filter((item)=>item.anomaly === 'anomaly'));
  },

  getRecDataAnomaly: function (data) {
    if (!data.labels) {
      return null;
    }
    if(data.labels.some(function(l){
          return l.startsWith('!!!');
      })) {
        return 'anomaly'
      }
    if(data.labels.some(function(l){
          return l.startsWith('???');
      })) {
        return 'warning'
      }
    return null;
  },

  calculateHeight: function (recData) {
    var me = this,
      sStore = Ext.getStore('Scans'),
      curScan = sStore.getById(recData.scanId),
      curScanIx = sStore.indexOfId(recData.scanId),
      pps = me.getConfig('pps'),
      calcHeight;
    if (curScanIx >=0) {
      var nextScan = sStore.getAt(curScanIx + 1);
      if (nextScan && ((me.lastScanHeight && (nextScan.getId() - recData.scanId) / 1000  * pps < me.lastScanHeight * 1.5 ) || ((nextScan.getId() - recData.scanId) / 1000  * pps  < curScan.get('data').length * 150 * 2))) { //!me.lastScanHeight &&
        calcHeight = (nextScan.getId() - recData.scanId) / 1000 * pps;
        me.lastScanHeight = calcHeight;
      } else {
        calcHeight = curScan.get('data').length * 0.1 * pps;
        if (calcHeight < me.lastScanHeight) {
          calcHeight = me.lastScanHeight;
        }
      }
    }
    return calcHeight;
  },

  prepareDataForPanorama: function (rec) {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      pps = me.getConfig('pps'),
      rectHeight = me.getConfig('rectHeight'),
      fqWidth = me.getConfig('fqWidth');
    var recData;
    if (rec.getData) {
      recData = rec.getData();
    } else {
      recData = rec;
      recData.anomaly = me.getRecDataAnomaly(recData);
      recData.isNoise = recData.labels && recData.labels.some((l)=>/NOISE/i.test(l));
      recData.forAdmin = recData.labels && recData.labels.some((l)=>l.startsWith('---'));
    }

    var fqs = me.getFqsByScanId(recData.scanId);

    var x = fqs.indexOf(+recData.receiverFq) * fqWidth + Math.round( (recData.fq - recData.receiverFq + Dronelyzer.FFT.INPUT_RATE / 2 - recData.bandwidth/2) * fqWidth / Dronelyzer.FFT.INPUT_RATE);
    var width = Math.round(recData.bandwidth * fqWidth / Dronelyzer.FFT.INPUT_RATE);
    var calcHeight = me.calculateHeight(recData);
    var y = Math.round((+startTime + tileSize - recData.scanId) * pps / 1000) - calcHeight;

    var fillStyle;
    if (Dronelyzer.FFT.paletteAnomalies[recData.anomaly]) {
      fillStyle = '#' + Dronelyzer.FFT.paletteAnomalies[recData.anomaly];
    }
    if (!fillStyle) {
      if (recData.isNoise) {
        fillStyle = '#' + Dronelyzer.FFT.paletteAnomalies['noise'];
      } else {
        fillStyle = '#' + Dronelyzer.FFT.paletteCSS[40];
      }
    }
    return {
      type: 'rect',
      x: x,
      y: y,
      width: width,
      height: calcHeight || rectHeight,
      fillStyle: fillStyle,
      recId: recData.id,
      weight: recData.anomaly === 'anomaly' ? 0 : (recData.anomaly === 'warning' ? 1 : (recData.isNoise ? 2 : 3)),
      scanId: recData.scanId,
      anomaly: recData.anomaly,
      isNoise: recData.isNoise,
      forAdmin: recData.forAdmin
    };
  },

  onStoreAdd: function (store, records) {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize');
    var data = records.filter((rec)=>(+rec.get('scanId') >= +startTime && +rec.get('scanId') < (+startTime) + tileSize));
    data.forEach((item) => {
      var bufferScan = me.bufferDetects[0];
      if (bufferScan && item.get('scanId') != bufferScan.get('scanId')) {
        me.drawBuffer(item.get('scanId'));
      }
      me.bufferDetects.push(item);
    });
  },

  onScanAdd: function (store, records) {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      pps = me.getConfig('pps'),
      data = records.map((rec)=>{
        return {
          scanId: rec.getId(),
          y: Math.round((+startTime + tileSize - rec.getId()) * pps / 1000)
        }
      });
    me.drawBuffer(records[0].getId());

    me.drawScans(data);
  },

  drawScans: function (data) {
    var me = this,
      g = me.getScene(),
      l = me.getConfig('scanTickSize');

    if (!g || g.empty()) {
      return;
    }

    me.gScans.selectAll()
      .data(data)
      .enter()
      .append('line')
      .attr('stroke', '#000000')
      .attr('x1', 0)
      .attr('x2', l)
      .attr('y1', function (d) {
          return d.y;
      })
      .attr('y2', function (d) {
          return d.y;
      })
      .attr('scanId', function (d) {
          return d.scanId;
      })
  },

  getFqsByScanId: function (scanId) {
    var me = this;
    var scanJson = me.getScanJsonByScanId(scanId);
    return scanJson.get('fqs');
  },

  getScanJsonByScanId: function (scanId) {
    var shStore = Ext.getStore('ScanHistory');
    var prevScanIx = shStore.findBy((rec, id)=>(+scanId <= +id)),
      res;
    if (!shStore.first()) {
      return;
    }
    if (prevScanIx === 0) {
      res = shStore.first();
    }
    else if (prevScanIx > 0) {
      res = shStore.getAt(prevScanIx - 1);
    } else {
      res = shStore.last();
    }
    return res;
  },

  getChangeoverByScanId: function (scanId) {
    var me = this;
    return me.configChanges.sort((a,z)=>z.getId() - a.getId()).find((scanJson)=>(+scanId >= +scanJson.getId()));
  },

  drawBuffer: function () { //nextScanId
    var me = this,
    data = [];
    me.bufferDetects.forEach((rec) => {
      var prepared = me.prepareDataForPanorama(rec);
      data.push(prepared);
    });
    me.bufferDetects = [];
    me.drawPanoramaFromData(data);
  },

  onScanHistoryAdd: function (shStore, records) {
    var me = this;
    records.sort((a,z)=>a.getId() - z.getId()).forEach((item) => {
      me.drawFqLinesByScanJson(item);
    });
  },

  drawFqLinesByScanJson: function (scanJson) {
    var me = this;
    var startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      pps = me.getConfig('pps'),
      fqWidth = me.getConfig('fqWidth'),
      shStore = Ext.getStore('ScanHistory');
    me.setMaxFqsCount(Math.max(me.getMaxFqsCount(), scanJson.get('fqs').length));
    var scanId = scanJson.getId();
    if (+scanId > +startTime + tileSize) {
      return;
    }
    var ix = shStore.indexOfId(scanId);
    if (ix > 0) {
      var prevScanJson = shStore.getAt(ix - 1),
        prevScanId = prevScanJson.getId();
      if (+scanId < +startTime) {
        me.gFqLines.selectAll('.scanConfigId-' + prevScanId).remove();
        me.gFqLines.selectAll('.scanFqsConfigId-' + prevScanId).remove();
      }
        me.gFqLines.selectAll('.scanConfigId-' + prevScanId)
        .attr('y1', Math.round((+startTime + tileSize - scanId) * pps / 1000) + pps);
        me.gFqLines.selectAll('.scanChangedTopFqs-' + prevScanId).remove();
        me.gFqLines.append('line')
        .attr('stroke', '#FFFFFF')
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,2")
        .attr('x1', 0)
        .attr('x2', Math.max(scanJson.get('fqs').length, prevScanJson.get('fqs').length) * fqWidth)
        .attr('y1', Math.round((+startTime + tileSize - scanId) * pps / 1000))
        .attr('y2', Math.round((+startTime + tileSize - scanId) * pps / 1000))
        .attr('scanId', scanId)
        .classed('scanChanged-' + scanId, true);
        var dataFqs = prevScanJson.get('fqs').map((fq, i)=>{
          return {
            fq: fq,
            x: i * fqWidth + 3
          }
        });
        var topFqs = Math.round((+startTime + tileSize - scanId) * pps / 1000) + pps + 10;
        me.gFqLines.selectAll()
        .data(dataFqs)
        .enter()
        .append('text')
        .attr('x', (d)=>d.x)
        .attr('y', topFqs)
        .attr('textLength', fqWidth - 6)
        .attr('lengthAdjust', 'spacingAndGlyphs')
        .classed('scanChangedTopFqs-' + prevScanId, true)
        .text((d)=>d.fq);
    }
    var nextScan = shStore.getAt(ix + 1);
    if (+startTime <= +scanId && +scanId <= +startTime + tileSize && nextScan && +nextScan.getId() >= +startTime && +nextScan.getId() <= +startTime + tileSize) {
      me.gFqLines.selectAll('.scanChanged-' + nextScan.getId()).remove();
      me.gFqLines.append('line')
        .attr('stroke', '#FFFFFF')
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,2")
        .attr('x1', 0)
        .attr('x2', Math.max(scanJson.get('fqs').length, nextScan.get('fqs').length) * fqWidth)
        .attr('y1', Math.round((+startTime + tileSize - nextScan.getId()) * pps / 1000))
        .attr('y2', Math.round((+startTime + tileSize - nextScan.getId()) * pps / 1000))
        .attr('scanId', nextScan.getId())
        .classed('scanChanged-' + nextScan.getId(), true)
      var curFqs = scanJson.get('fqs').map((fq, i)=>{
        return {
          fq: fq,
          x: i * fqWidth + 3
        }
      });
      var topNextFqs = Math.round((+startTime + tileSize - nextScan.getId()) * pps / 1000) + pps + 10;
      me.gFqLines.selectAll()
      .data(curFqs)
      .enter()
      .append('text')
      .attr('x', (d)=>d.x)
      .attr('y', topNextFqs)
      .attr('textLength', fqWidth - 6)
      .attr('lengthAdjust', 'spacingAndGlyphs')
      .classed('scanChanged-' + nextScan.getId(), true)
      .text((d)=>d.fq);
    }
    if (!nextScan || (+nextScan.getId() >= +startTime)) {
      var y1 = (nextScan && +nextScan.getId() >= +startTime && +nextScan.getId() <= (+startTime + tileSize)) ? Math.round((+startTime + tileSize - nextScan.getId()) * pps / 1000) + pps : 0;
      var data = scanJson.get('fqs').map((fq, i)=>{
        return {
          fq: fq,
          x1: (i + 1) * fqWidth,
          x2: (i + 1) * fqWidth,
          y1: y1,
          y2: scanId > +startTime ? Math.round((+startTime + tileSize - scanId) * pps / 1000) : Math.round(tileSize * pps / 1000)
        }
      });
      me.gFqLines.selectAll()
      .data(data)
      .enter()
      .append('line')
      .attr('stroke', '#FFFFFF')
      .attr("stroke-opacity", 0.5)
      .attr("stroke-dasharray", "2,2")
      .attr('x1', (d)=>d.x1)
      .attr('x2', (d)=>d.x2)
      .attr('y1', (d)=>d.y1)
      .attr('y2', (d)=>d.y2)
      .attr('scanId', scanId)
      .attr('fq', (d)=>d.fq)
      .classed('scanConfigId-' + scanId, true);
      me.gFqLines.selectAll()
      .data(data)
      .enter()
      .append('text')
      .attr('x', (d)=>d.x1 - fqWidth + 3)
      .attr('y', (d)=>d.y2 - 5)
      .attr('textLength', fqWidth - 6)
      .attr('lengthAdjust', 'spacingAndGlyphs')
      .classed('scanFqsConfigId-' + scanId, true)
      .text((d)=>d.fq);
    }
  },

  onStoreLoad: function () {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      store = me.getConfig('store');
    var data = [], scans = {};
    store.each((rec)=>{
      if (+rec.get('scanId') >= +startTime && +rec.get('scanId') < (+startTime) + tileSize) {
        if (!scans[+rec.get('scanId')]) {
          scans[+rec.get('scanId')] = [{
            receiverFq: rec.get('receiverFq'),
            remoteTime: rec.get('remoteTime')
          }];
        } else {
          scans[+rec.get('scanId')].push({
            receiverFq: rec.get('receiverFq'),
            remoteTime: rec.get('remoteTime')
          });
        }
        data.push(rec);
      }
    });
    Ext.getStore('Scans').add(Object.keys(scans).map((scanId)=>{ return {id: scanId, data: scans[scanId]}}));
    if (data.length > 0) {
      var prepared = data.map((rec)=>me.prepareDataForPanorama(rec)).sort((d1, d2)=>d2.weight - d1.weight);
      me.drawPanoramaFromData(prepared);
    }
  },

  initScene: function () {
    var me = this,
      startTime = me.getStartTime(),
      tileSize = me.getTileSize(),
      store = me.getStore(),
      pps = me.getPps(),
      timeScaleWidth = me.getConfig('timeScaleWidth'),
      fqWidth = me.getConfig('fqWidth');
    if (+startTime + tileSize < +new Date()) {
      me.setHeight(tileSize * pps / 1000);
      me.isArchived = true;
      var svg = me.getSvg();
      svg
        .attr("viewBox", "-" + timeScaleWidth + " 0 " + (me.getMaxFqsCount() * fqWidth + timeScaleWidth) + " " + (tileSize * pps / 1000))
        .attr("preserveAspectRatio", "none");
    } else {
      Ext.getStore('Scans').on('add', me.onScanAdd, me);
      me.onStoreLoad();
      store.on('add', me.onStoreAdd, me);
      store.on('load', me.onStoreLoad, me);
      me.setHeight(Math.round((+new Date() - startTime) * pps / 1000));
      Ext.defer(me.onInterval, 1000, me);
    }
    me.gY = me.getSvg().append('g')
      .call(
        d3.axisLeft(
          d3.scaleTime()
            .range([0, tileSize * pps / 1000])
            .domain([new Date(+startTime + tileSize), new Date(+startTime)])
        )
        .ticks(d3.timeMinute.every(1))
        .tickFormat((d) => {
          return (d.getMinutes() % 5) ? null : (d3.scaleTime().tickFormat())(d);
        })
      )
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line")
        .attr("stroke", "#FFFFFF"))
      .call(g => g.selectAll(".tick text")
        .attr("fill", "#FFFFFF"));
    Ext.getStore('ScanHistory').each((item)=>{
      me.drawFqLinesByScanJson(item);
    });
    Ext.getStore('ScanHistory').on('add', me.onScanHistoryAdd, me);
    me.loadData();
  },

  resizeTile: function () {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      pps = me.getConfig('pps'),
      timeScaleWidth = me.getConfig('timeScaleWidth'),
      fqWidth = me.getConfig('fqWidth'),
      now = +new Date(),
      newHeight, newY;
    if (+startTime + tileSize <= now){
      newHeight = tileSize * pps / 1000;
      newY = 0;
    } else {
      newHeight = Math.round((now - startTime) * pps / 1000);
      newY = Math.round((+startTime + tileSize - now) * pps / 1000);
    }
      me.setHeight(newHeight);
      var svg = me.getSvg();
      svg
      .attr("viewBox", "-" + timeScaleWidth + " " + newY + " " + (me.getMaxFqsCount() * fqWidth + timeScaleWidth) + " " + newHeight)
      .attr("preserveAspectRatio", "none");
    me.fireEventArgs('resizetile', [me]);
  },

  onInterval: function () {
    var me = this,
      startTime = me.getConfig('startTime'),
      tileSize = me.getConfig('tileSize'),
      now = +new Date();
    if (me.bufferDetects.length) {
      if (me.lastScanHeight) {
        var scanId = me.bufferDetects[0].get('scanId');
        if ((now - scanId) / 1000 > me.lastScanHeight * 1.5) {
          me.drawBuffer();
        }
      }
    }
    Ext.undefer(me.timerId);
    if (+startTime + tileSize <= now){
      me.getStore().un('add', me.onStoreAdd);
      me.getStore().un('load', me.onStoreLoad);
      Ext.getStore('ScanHistory').un('add', me.onScanHistoryAdd);
      me.fireEventArgs('tilefinished', [startTime]);
    } else {
      Ext.defer(me.onInterval, 1000, me);
    }
    if (!me.getHoldResize()) {
      me.resizeTile();
    }
  },

  loadData: function () {
    var me = this;
    if (me.tileWorker && me.isArchived && !me.isLoading && !me.isLoaded) {
      me.isLoading = true;
      var locatorRec = Ext.getStore('Locators').getById(me.getLocator());
      if (!locatorRec) {
        return;
      }
      var locatorData = locatorRec.getData({persist: true});
      locatorData.fixedUrl = locatorRec.get('fixedUrl');
      me.tileWorker.postMessage({locator: locatorData, startTime: me.getStartTime()});
    }
  }

});
