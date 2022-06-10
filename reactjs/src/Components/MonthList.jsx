import * as React from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from "@mui/material/ListSubheader";
import './MonthList.scss';
import 'dayjs/locale/uk';
import config from '../config/index.js';

const minD = config.periodLimit.min;
const maxD = config.periodLimit.max;

const capitalize = ([ first, ...rest ], locale = navigator.language) =>
  first.toLocaleUpperCase(locale) + rest.join('')

export default function MonthList(props) {
  const {period, periodChange, locale} = props;
  let listItems, months = [], startIndex, endIndex;

  const handleListItemClick = (event, index) => {
    if (startIndex !== undefined && endIndex !== undefined) {
      startIndex = index;
      endIndex = undefined;
    } else if (startIndex !== undefined) {
      if (index < startIndex) {
        endIndex = startIndex;
        startIndex = index;
      } else {
        endIndex = index;
      }
    } else {
      startIndex = index;
    }
    periodChange({
      start: startIndex !== undefined ? (months[startIndex].startOf('month').isBefore(minD) ? minD : months[startIndex].startOf('month')): undefined,
      end: endIndex !== undefined ? months[endIndex].endOf('month').startOf('date') : undefined
    });
  };


  function getListItems(fromIndex, toIndex) {
    let items = [];
    for (let i = fromIndex; i <= toIndex; i++) {
      items.push(<ListItemButton
        key={i}
        className={(() => {
          const classes = [];
          if (i === startIndex) {
            classes.push('MonthList-selected-first');
          }
          if (i === endIndex) {
            classes.push('MonthList-selected-last');
          }
          if (i > startIndex && i < endIndex) {
            classes.push('MonthList-selected');
          }
          return classes.join(' ');
        })()}
        onClick={(event) => handleListItemClick(event, i)}
      >
        <ListItemText primary={capitalize(minD.add(i, 'month').locale(locale).format('MMMM'),locale)}/>
      </ListItemButton>)
    }
    return items;
  }

  for (let i = 0, curDate; (curDate = minD.add(i, 'month')).isBefore(maxD.add(1, 'month'), 'month'); i++) {
    months.push(curDate);
    if (period.start && curDate.isSame(period.start, 'month') && curDate.isSame(period.start, 'year')) {
      startIndex = i;
    }
    if (period.end && curDate.isSame(period.end, 'month') && curDate.isSame(period.end, 'year')) {
      endIndex = i;
    }
  }

  let years = months.reduce((res, m, ix) => {
    if (!res[res.length - 1] || res[res.length - 1].year !== m.year()) {
      res.push({year: m.year(), start: ix, end: ix})
    } else {
      res[res.length - 1].end = ix;
    }
    return res;
  }, [])


  listItems = years.map((y) => {
    return (
      <li key={`section-${y.year}`}>
        <ul>
          <ListSubheader>{`${y.year}`}</ListSubheader>
          {getListItems(y.start, y.end)}
        </ul>
      </li>
    )
  })

  return (
    <Box sx={{
      width: '100%',
      bgcolor: 'background.paper',
      flexGrow: 1,
      flexDirection: 'column',
      display: 'contents'
    }}>
      <List aria-label="main month range" sx={{
        overflow: 'auto',
        '& ul': {padding: 0}
      }} subheader={<li/>}>
        {listItems}
      </List>
    </Box>
  );
}
