import React, {useCallback, useEffect, useRef, useState} from "react";
import {InputAdornment, TextField} from "@mui/material";
import {useLoadScript} from "@react-google-maps/api";
import SearchIcon from '@mui/icons-material/Search';
import IconButton from "@mui/material/IconButton";
import {Clear} from "@mui/icons-material";
import config from "../config/index.js";

export default function SearchBox ({ onPlacesChanged, placeholder, variant, size, fullWidth, className }) {
  const input = useRef(null);
  const searchBox = useRef(null);
  const [libraries] = useState(['places']);
  const [isEmpty, setIsEmpty] = useState(true);
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: config.googleMapsApiKey,
    libraries: libraries
  });

  useEffect(() => {
    if (isEmpty) {
      onPlacesChanged();
    }
  }, [isEmpty, onPlacesChanged]);

  const handleOnPlacesChanged = useCallback(() => {
    if (onPlacesChanged) {
      onPlacesChanged(searchBox.current.getPlaces());
    }
  }, [onPlacesChanged, searchBox]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!searchBox.current && window.google && window.google.maps) {
      searchBox.current = new window.google.maps.places.SearchBox(input.current);
      searchBox.current.addListener('places_changed', handleOnPlacesChanged);
    }

    return () => {
      if (window.google && window.google.maps) {
        searchBox.current = null;
        window.google.maps.event.clearInstanceListeners(searchBox);
      }
    };
  }, [handleOnPlacesChanged, isLoaded]); //

  return <TextField
    id="googlesearch"
    type="text"
    className={className}
    placeholder={isLoaded ? placeholder : (loadError ? 'Search on map is not available' : 'Loading...')}
    fullWidth={fullWidth}
    variant={variant}
    size={size}
    disabled={!isLoaded || loadError}
    inputProps={{
      ref: input,
    }}
    onChange={(e) => setIsEmpty(!e.target.value)}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon />
        </InputAdornment>
      ),
      endAdornment: (
        <InputAdornment position="end">
          <IconButton
            aria-label="clear search field"
            onClick={() => {
              input.current.value = "";
              setIsEmpty(true);
            }}
            edge="end"
            hidden={isEmpty}
          >
            <Clear/>
          </IconButton>
        </InputAdornment>
      )
    }}
  />
};