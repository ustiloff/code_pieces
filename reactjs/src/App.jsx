import React, {useCallback, useEffect, useMemo, useState} from "react";
import './App.scss';
import Map from './Components/Map';
import {Box, Container, InputAdornment, TextField} from "@mui/material";
import DateAdapter from '@mui/lab/AdapterDayjs';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import MonthList from "./Components/MonthList";
import Button from '@mui/material/Button';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import {ThemeProvider} from '@mui/material/styles';
import FilterDialog from "./Components/FilterDialog";
import 'dayjs/locale/uk';
import config from './config';
import FilterContext from "./Contexts/FilterContext";
import i18n from './utils/i18n';
import {useTranslation} from 'react-i18next';
import FormControl from '@mui/material/FormControl';
import FaceContext from "./Contexts/FaceContext";
import FaceDetailRnd from "./Components/FaceDetailRnd";
import {getPeriodText} from "./utils";
import IconButton from "@mui/material/IconButton";
import {Clear} from "@mui/icons-material";
import {Outlet, Route, Routes, useNavigate} from "react-router-dom";
import "@fontsource/rubik";
import Theme from './utils/theme';
import DayJS from "dayjs";
import Checkout from "./Components/Checkout";
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import SearchBox from "./Components/SearchBox";
import MenuButton from "./Components/MenuButton";
import FaceRequest from "./Components/FaceRequest";
import About from "./Components/About";

function App() {
  const [openDialogPeriod, setOpenDialogPeriod] = useState(false);
  const [openDialogPrice, setOpenDialogPrice] = useState(false);


  const [period, setPeriod] = useState({
    start: config.periodLimit.min.add(1, 'month').startOf('month'),
    end: config.periodLimit.min.add(1, 'month').endOf('month').startOf('date')
  });
  const [dialogPeriod, setDialogPeriod] = useState({...period});

  const [price, setPrice] = useState('');
  const [dialogPrice, setDialogPrice] = useState('');

  const [faces, setFaces] = useState({});

  const [place, setPlace] = useState([]);
  const [face, setFace] = useState();

  const [cart, setCart] = useState((window.localStorage.getItem('cart') && JSON.parse(window.localStorage.getItem('cart'))) || []);

  const [searchPlace, setSearchPlace] = useState();

  const {t} = useTranslation();
  const navigate = useNavigate();

  const filterContext = {
    period,
    setPeriod,
    price,
    setPrice
  }

  const faceContext = {
    place,
    setPlace,
    face,
    setFace,
    faces,
    setFaces,
    cart,
    setCart
  };

  cart.forEach((item) => {
    item.startDate = DayJS(item.startDate);
    item.endDate = DayJS(item.endDate);
    item.createdAt = DayJS(item.createdAt);
  })

  useEffect(() => {
    window.localStorage.setItem('cart', JSON.stringify(faceContext.cart));
  }, [faceContext.cart]);

  useEffect(() => {
    if (faceContext.face && faceContext.faces && (!faceContext.place[0] || (+faceContext.place[0].lon !== +faceContext.face.lon || +faceContext.place[0].lat !== +faceContext.face.lat))) {
      let pf = Object.values(faceContext.faces).filter((f) => (+f.lon === +faceContext.face.lon && +f.lat === +faceContext.face.lat));
      setPlace(pf);
    } else if (!faceContext.face) {
      setPlace([]);
    }
  }, [faceContext.face, faceContext.faces, faceContext.place]);
  const theme = Theme;

  const handlePeriodClick = () => {
    setDialogPeriod({...period});
    setOpenDialogPeriod(true);
  }
  const handleDialogPeriodChange = (period) => {
    setDialogPeriod(period);
  }
  const handlePriceClick = () => {
    setDialogPrice(price);
    setOpenDialogPrice(true);
  }
  const handlePriceChange = (event) => {
    setDialogPrice(parseInt(event.target.value) > 0 ? (parseInt(event.target.value) <= 200000 ? parseInt(event.target.value) : (dialogPrice || 200000)) : '');
  };
  const handleApplyPriceClick = () => {
    setPrice(dialogPrice);
  }
  const handleApplyPeriodClick = () => {
    setPeriod({...dialogPeriod});
  }

  const handleOnPlaceChanged = useCallback((places) => {
    if (!places || places.length === 0) {
      setSearchPlace(null);
      return;
    }
    const place = places[0];
    setSearchPlace([place.geometry.location.lng(), place.geometry.location.lat()]);
  }, [setSearchPlace]);
  let vh = window.innerHeight * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);

  return (
    <LocalizationProvider dateAdapter={DateAdapter}>
      <ThemeProvider theme={theme}>
        <FaceContext.Provider value={faceContext}>
          <FilterContext.Provider value={filterContext}>
            <Routes>
              <Route path="/" element={(
                <div className='mainview'>
                  <Map
                    searchPlace={searchPlace}
                  >
                  </Map>
                  <MenuButton sx={{position: 'absolute', top: 14, left: 3}}/>
                  <div className={'App-maintoolbar'}>
                    <SearchBox
                      onPlacesChanged={handleOnPlaceChanged}
                      variant="filled"
                      size="small"
                      placeholder={t('searchEditPlaceholder')}
                      fullWidth
                      className="main-searchbox"
                    />
                    <Container style={{width: '100%', display: "flex", padding: '10px 0px 0px 0px'}}>
                      <Box sx={{flexGrow: 1, flexShrink: 1}} style={{paddingRight: '5px'}}>
                        <Button color={"secondary"} variant="contained" size={"medium"} fullWidth
                                onClick={(e) => {
                                  handlePeriodClick(e);
                                }} className={"App-mainfilterbutton"}>
                          <CalendarMonthIcon sx={{float: "left"}}/>
                          <Box sx={{
                            width: "100%",
                            textAlign: "center"
                          }}>{getPeriodText(period.start, period.end, i18n.language)}</Box>
                        </Button>
                      </Box>
                      <Box sx={{flexGrow: 1, flexShrink: 1}} style={{paddingLeft: '5px'}}>
                        <Button color={"secondary"} variant="contained" size={"medium"} fullWidth
                                onClick={(e) => {
                                  handlePriceClick(e);
                                }}>
                          <AccountBalanceWalletIcon sx={{float: "left"}}/>
                          <Box sx={{
                            width: "100%",
                            textAlign: "center"
                          }}>{price ? t('upToPriceText', {price}) : t('buttonPriceText')}</Box>
                        </Button>
                      </Box>
                    </Container>
                  </div>
                  {!!faceContext.cart.length && (
                    <div className="disable-select checkout"
                         style={{position: 'absolute', bottom: 0, width: '100%', display: 'flex'}}>
                      <div style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '10px 20px',
                        display: 'box',
                        margin: 'auto',
                        color: 'white'
                      }}>
                        <div style={{fontSize: 13, fontWeight: 400}}>
                          {t('boards', {count: faceContext.cart.length})}
                        </div>
                        <div style={{fontSize: 15, fontWeight: 500}}>
                          {faceContext.cart.reduce((res, c) => {
                            return res + c.total;
                          }, 0)} &nbsp;₴
                        </div>
                      </div>
                      <div style={{padding: '10px 20px', margin: 'auto'}}>
                        <Button
                          variant="checkoutbutton"
                          startIcon={<ShoppingBagIcon/>}
                          onClick={() => {
                            navigate('/checkout');
                          }}
                        >
                          {t('faceDetailCheckoutButtonLabel')}
                        </Button>
                      </div>
                    </div>
                  )}
                  <FilterDialog
                    title={t('dialogPeriodTitle')}
                    open={openDialogPeriod}
                    setOpen={setOpenDialogPeriod}
                    onApplyClick={handleApplyPeriodClick}
                    isValid={
                      !!dialogPeriod && !!dialogPeriod.start && !!dialogPeriod.end
                    }
                    sx={{
                      '& .MuiDialog-paper': {
                        minWidth: 400
                      },
                    }}
                  >
                    <MonthList
                      period={dialogPeriod}
                      periodChange={handleDialogPeriodChange}
                      locale={i18n.language}
                    />
                  </FilterDialog>
                  <FilterDialog title={t('dialogPriceTitle')} open={openDialogPrice} setOpen={setOpenDialogPrice}
                                onApplyClick={handleApplyPriceClick}>
                    <FormControl fullWidth sx={{p: 2}} variant="outlined">
                      <TextField
                        value={dialogPrice}
                        onChange={handlePriceChange}
                        autoFocus
                        label={i18n.t('pricePerMonthLabel')}
                        variant="outlined"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="clear price field"
                                onClick={() => setDialogPrice('')}
                                edge="end"
                                hidden={!dialogPrice}
                              >
                                <Clear/>
                              </IconButton>
                              &nbsp;&nbsp;
                            </InputAdornment>
                          )
                        }}
                      />
                    </FormControl>
                  </FilterDialog>
                  <Outlet/>
                </div>)}>
                <Route path="faces/:faceId" element={(
                  <FaceDetailRnd/>
                )}/>
                <Route path="sides/:sideNo" element={(
                  <FaceDetailRnd/>
                )}/>
                <Route path="request/:faceId" element={(
                  <FaceRequest/>
                )}/>
                <Route path="checkout" element={(
                  <Checkout/>
                )}/>
                <Route
                  path="about"
                  element={<About/>}
                />
              </Route>
            </Routes>
          </FilterContext.Provider>
        </FaceContext.Provider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

export default App;
