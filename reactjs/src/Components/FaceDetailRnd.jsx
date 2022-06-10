import * as React from 'react';
import {useContext, useEffect, useMemo, useState} from 'react';
import {Rnd} from 'react-rnd';
import useWindowDimensions from "../hooks/useWindowDimensions";
import Carousel from 'react-material-ui-carousel'
import CardMedia from '@mui/material/CardMedia';
import CircleIcon from '@mui/icons-material/Circle';
import FaceContext from "../Contexts/FaceContext";
import {useNavigate, useParams, useMatch} from "react-router-dom";
import i18n from "../utils/i18n";
import Button from "@mui/material/Button";
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import SendIcon from '@mui/icons-material/Send';
import {red} from '@mui/material/colors';
import FilterContext from "../Contexts/FilterContext";
import {Feature} from "ol";
import {Point} from "ol/geom";
import {fromLonLat} from "ol/proj";
import {calcTotalByPeriod} from "../utils";
import DayJS from "dayjs";
import utc from 'dayjs/plugin/utc';

DayJS.extend(utc);

export default function FaceDetailRnd() {
  const {height: winHeight} = useWindowDimensions();
  const [height, setHeight] = useState(0); //winHeight / 2
  const [transition, setTransition] = useState('height 500ms');
  const [isDown, setIsDown] = useState(false);
  const [prevY, setPrevY] = useState(0);
  const [prevDelta, setPrevDelta] = useState(0);
  const [isTouch, setIsTouch] = useState(false);
  const [isResize, setIsResize] = useState(false);
  const [startPoint, setStartPoint] = useState({x: 0, y: 0});
  const [carouselIndex, setCarouselIndex] = useState(0);
  const faceContext = useContext(FaceContext);
  const filterContext = useContext(FilterContext);
  const params = useParams();
  const navigate = useNavigate();

  const isFaces = useMatch('/faces/:id');
  const isSides = useMatch('/sides/:sideNo');
  const {faceId, sideNo} = params;
  const faces = faceContext.faces;

  const freeRe = useMemo(()=>{
    if (!filterContext || !filterContext.period) {
      return;
    }
    const startDate = filterContext.period.start,
      endDate = filterContext.period.end,
      wholePeriod = false,
      minFreeDays = 15,
      allowTempRes = true,
      now = new Date(),
      minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const daysToBeg = Math.round((startDate - minDate) / (3600 * 24 * 1000)),
      daysPeriod = Math.round((endDate - startDate) / (3600 * 24 * 1000));

    if (daysPeriod < 0) {
      return;
    }
    return new RegExp('^.{' + daysToBeg + (wholePeriod ? '' : ',' + (daysToBeg + daysPeriod - minFreeDays)) + '}(' + (allowTempRes ? '[tf]' : 'f') + '{' + daysPeriod +'})');
  }, [filterContext]);

  function updateFace (face) {
    const occ = face.occByDays;
    const feature = face.feature;
    if (!occ) {
      face.status = 'unknown';
    } else {
      // var tmpOcc = occ.slice(daysToBeg);
      if (!freeRe || freeRe.test(occ)) {
        // faces[rec.getId()] = freeRe.exec(occ)[1].length;
        face.status = 'free';
      } else {
        face.status = 'sold';
      }
    }
    const cartItem = faceContext.cart.find((item)=>{
      return (
        item.id === face.id &&
        +item.startDate.toDate() <= +filterContext.period.start.toDate() &&
        +item.endDate.toDate() >= +filterContext.period.end.toDate()
      )
    });
    face.inCart = !!cartItem ? 1 : 0;
    face.pricePerMonth = face.price + face.printCost + face.deliveryCost;
    face.total = calcTotalByPeriod({
      price: face.pricePerMonth,
      startDate: filterContext.period.start,
      endDate: filterContext.period.end,
      printCost: face.printCost,
      deliveryCost: face.deliveryCost
    });
    if (feature) {
      feature.setProperties({
        pricePerMonth: face.pricePerMonth,
        status: face.status,
        inCart: face.inCart,
        total: face.total
      });
    }
  }

  useEffect(() => {
    if (faceContext.face && !height) {
      setHeight(winHeight / 2);
    }
    if (!faceContext.face) {
      setHeight(0);
    }
  }, [winHeight, faceContext.face, height]); //faceContext.face

  useEffect(() => {
    if (faceContext.place.indexOf(faces[faceId]) >= 0 && faceContext.place.indexOf(faces[faceId]) !== carouselIndex) {
      setCarouselIndex(faceContext.place.indexOf(faces[faceId]));
    }
    faceContext.setFace(faces[faceId]);
  }, [faceId, carouselIndex, faceContext, faces]);

  useEffect(() => {
    if (faceContext.face && faceContext.place.indexOf(faceContext.face) >= 0 && faceContext.place.indexOf(faceContext.face) !== carouselIndex) {
      setCarouselIndex(faceContext.place.indexOf(faceContext.face));
    }
  }, [faceContext.place, carouselIndex, faceContext.face]);

  useEffect(() => {
    let url = '';
    if (isSides) {
      if (sideNo) {
        url = `/api/v1/geoquery/side/${sideNo}`;
      } else {
        navigate('/');
        return;
      }
    }
    else if (isFaces && faceId && !faceContext.face && !faces[faceId]) {
      url = `/api/v1/geoquery/face/${faceId}`
    }
    if (url) {
      fetch(url)
        .then(res => res.json())
        .then(
          (result) => {
            if (result.error || !result.features || !result.features.length) {
              navigate('/');
            } else {
              const newFaces = result.features.reduce((res, nf)=>{
                const f = new Feature();
                f.setGeometry(new Point(fromLonLat([nf.lon, nf.lat])))
                f.setId(nf.id);
                f.setProperties(nf.properties);
                res[nf.id] = {...nf.properties, feature: f};
                updateFace(res[nf.id]);
                return res;
              }, {});
              faceContext.setFaces({...faceContext.faces, ...newFaces});
              if (isFaces && faceId) {
                faceContext.setFace(newFaces[faceId]);
              } else if (isSides && sideNo) {
                const face = Object.values(newFaces).find((f)=>f.sides.find((s)=>+s.num===+sideNo));
                if (face) {
                  faceContext.setFace(face);
                } else {
                  navigate('/');
                }
              } else {
                navigate('/');
              }
            }
          },
          () => {
            navigate('/');
          }
        )
    }
    setTransition('height 500ms');
    setHeight(winHeight / 2);
    return () => {
      setTransition('height 500ms');
      setHeight(0);
    }
  }, []);

  function normalizeHeight() {
    if (height === 0 || height === winHeight / 2 || height === winHeight) {
      return
    }
    setTransition('height 500ms');
    if (height < (winHeight * 0.25)) {
      navigate('/');
      setHeight(0);
    } else if (height > (winHeight * 0.75)) {
      setHeight(winHeight);
    } else {
      setHeight(winHeight / 2);
    }
  }

  const onResize = (e, direction, ref, delta) => {
    setHeight(height + delta.height - prevDelta);
    setPrevDelta(delta.height);
  };

  const onResizeStart = () => { //e, direction, ref, delta
    setPrevDelta(0);
    setIsDown(false);
    setIsResize(true);
    setTransition('');
  };

  const onResizeStop = () => { //e, direction, ref, delta
    normalizeHeight();
    setIsResize(false);
  };
  const handlePointerDown = (e) => {
    if (isResize) {
      return;
    }
    setStartPoint({x: e.screenX, y: e.screenY});
    setTransition('');
    setIsDown(true);
    setPrevY(e.clientY);
  }

  const handlePointerMove = (e) => {
    if (isResize) {
      return;
    }
    if (isDown && !isTouch) {
      setHeight((height - e.clientY + prevY));
      setPrevY(e.clientY);
    }
  }

  const handleTouchStart = (e) => {
    if (isResize) {
      return;
    }
    setStartPoint({x: e.changedTouches[0].screenX, y: e.changedTouches[0].screenY});
    setIsTouch(true);
    setTransition('');
    setIsDown(true);
    setPrevY(e.changedTouches[0].screenY);
  }

  const handleTouchMove = (e) => {
    if (isResize) {
      return;
    }
    if (isDown && e.changedTouches) {
      setHeight(height - e.changedTouches[0].screenY + prevY);
      setPrevY(e.changedTouches[0].screenY);
    }
  }

  const handlePointerUp = (e) => {
    if (isResize) {
      return;
    }
    const point = {
      x: ((e.changedTouches && e.changedTouches[0]) || e).clientX,
      y: ((e.changedTouches && e.changedTouches[0]) || e).clientY
    };
    normalizeHeight();
    setIsDown(false);
    if (Math.abs(point.x - startPoint.x) >= Math.abs(point.y - startPoint.y)) {
      let newIndex;
      if (point.x < startPoint.x) {
        if (carouselIndex < faceContext.place.length - 1) {
          newIndex = carouselIndex + 1;
        }
      } else {
        if (carouselIndex) {
          newIndex = carouselIndex - 1;
        }
      }
      if (newIndex !== undefined) {
        handleCarouselChange(newIndex);
      }
    }
  }

  const handlePointerLeave = () => {
    if (isResize || !isDown) {
      return;
    }
    setIsDown(false);
    normalizeHeight();
  }

  const handleCarouselChange = (next) => {
    setCarouselIndex(next);
    const nextFace = faceContext.place[next];
    if (nextFace && nextFace !== faceContext.face) {
      navigate('/faces/' + nextFace.id);
    }
  }

  const MyHandle = React.forwardRef((props, ref) => {
    return <div ref={ref} className={`face-detail-resize custom-handle-n`} {...props} />;
  });

  return (<Rnd
      className='box face-detail absolutely-positioned bottom-aligned disable-select'
      style={{transition: transition}}
      disableDragging={true}
      enableResizing={{
        top: true,
        right: false,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false
      }}
      dragAxis={'none'}
      bounds={'window'}
      resizeHandleComponent={{
        top: <MyHandle/>
      }}
      default={{
        height: '50%'
      }}
      size={{
        height
      }}
      onResize={onResize}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handlePointerUp}
      onTouchMove={handleTouchMove}
    >
      <Carousel autoPlay={false}
                fullHeightHover={true}
                index={carouselIndex}
                swipe={false}
                height={height - 150}
                indicatorContainerProps={{style: {zIndex: 5, position: 'absolute', bottom: 0}}}
                IndicatorIcon={<CircleIcon fontSize={'small'}/>}
                indicatorIconButtonProps={{className: 'carouselIndicator', style: {color: '#FFFFFF', fontSize: 15}}}
                activeIndicatorIconButtonProps={{className: 'carouselActiveIndicator', style: {color: '#23b0fd'}}}
                onChange={handleCarouselChange}
      >
        {faceContext.place.map((f) => (
          <CardMedia
            className="carousel-photo"
            key={f.id}
            image={`https://bma.bigmedia.ua/photohub/face/${f.id}`}
            sx={{height: height - 150}}/>
        ))}
      </Carousel>
      <div className='disable-select' style={
        {
          position: 'relative',
          width: '100%',
          flex: 1,
          textAlign: 'left',
          padding: '0 20px',
          borderBottom: '1px solid #e1e1e1',
          display: 'flex',
          justifyContent: 'start',
          alignItems: 'center'
        }
      }>
        <div>
          <div className="face-address">
            {faceContext.face && faceContext.face['address_' + i18n.t('addressSuffix')]}
          </div>
          <div className="face-params">
            {faceContext.face && i18n.t('refNetwork.' + faceContext.face.id_network)}
            &nbsp;•&nbsp;
            {faceContext.face && i18n.t('refSize.' + faceContext.face.id_size)}
          </div>
        </div>
      </div>
      {faceContext.face && faceContext.face.status !== 'sold' && (
        <div className={(faceContext.face && faceContext.face.inCart) ? "disable-select checkout" : "disable-select"}
             style={{display: 'flex', width: '100%'}}>
          <div style={{flex: 1, textAlign: 'left', padding: '10px 20px', display: 'box', margin: 'auto'}}>
            {faceContext.face && faceContext.face.pricePerMonth !== faceContext.face.total && (
              <div style={{fontSize: 12, fontWeight: 500}}>
                {faceContext.face.pricePerMonth + ' ' + i18n.t('hryvniaPerMonth')}
              </div>
            )}
            <div style={{fontSize: 15, fontWeight: 500}}>
              {faceContext.face && faceContext.face.total} ₴
            </div>
          </div>
          <div style={{padding: '10px 20px', margin: 'auto'}}>
            {faceContext.face && !faceContext.face.inCart && (
              <Button
                variant="addbutton"
                startIcon={<ShoppingBagIcon/>}
                onClick={() => {
                  faceContext.setCart([
                    ...faceContext.cart, {
                      ...faceContext.face,
                      startDate: filterContext.period.start,
                      endDate: filterContext.period.end,
                      createdAt: new DayJS()
                    }
                  ]);
                }}
                onTouchEnd={(e)=> {
                  normalizeHeight();
                  setIsDown(false);
                  e.stopPropagation();
                }}
                onPointerUp={(e)=> {
                  normalizeHeight();
                  setIsDown(false);
                  e.stopPropagation();
                }}
              >{i18n.t('faceDetailAddButtonLabel')}</Button>
            )}
            {faceContext.face && !!faceContext.face.inCart && (
              <Button
                variant="checkoutbutton"
                startIcon={<ShoppingBagIcon/>}
                onClick={() => {navigate('/checkout');}}
                onTouchEnd={(e)=> {
                  normalizeHeight();
                  setIsDown(false);
                  e.stopPropagation();
                }}
                onPointerUp={(e)=> {
                  normalizeHeight();
                  setIsDown(false);
                  e.stopPropagation();
                }}
              >
                {i18n.t('faceDetailCheckoutButtonLabel')}
              </Button>
            )}
          </div>
        </div>
      )}
      {faceContext.face && faceContext.face.status === 'sold' && (
        <div className="disable-select"
             style={{display: 'flex', width: '100%', backgroundColor: red["500"], color: 'white'}}>
          <div style={{
            flex: 1,
            textAlign: 'left',
            padding: '10px 20px',
            display: 'box',
            margin: 'auto',
            fontWeight: "bold"
          }}>
            {i18n.t('soldStatus')}
          </div>
          <div style={{padding: '10px 20px', margin: 'auto'}}>
            <Button
              variant="sendbutton"
              startIcon={<SendIcon/>}
              onClick={() => navigate(`/request/${faceId}`)}
            >
              {i18n.t('faceDetailSendMessageLabel')}
            </Button>
          </div>
        </div>
      )}
    </Rnd>
  );
}
