/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 11:54:20
 * @modify date 2019-01-20 11:54:20
 * @desc [description]
 */

function genSessionID() {
  let sessionID = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZabcdefghijklmnopqrstuvwxyz0123456789';
  const numPossible = possible.length;
  for (let i = 0; i < 16; i++) {
    sessionID += possible.charAt((Math.random() * numPossible) | 0);
  }
  return sessionID;
}

function dateFormat(date, fstr, utc) {
  utc = utc ? 'getUTC' : 'get';
  return fstr.replace(/%[YmdHMS]/g, function(m) {
    switch (m) {
    case '%Y':
      return date[utc + 'FullYear'](); // no leading zeros required
    case '%m':
      m = 1 + date[utc + 'Month']();
      break;
    case '%d':
      m = date[utc + 'Date']();
      break;
    case '%H':
      m = date[utc + 'Hours']();
      break;
    case '%M':
      m = date[utc + 'Minutes']();
      break;
    case '%S':
      m = date[utc + 'Seconds']();
      break;
    default:
      return m.slice(1); // unknown code, remove %
    }
    // add leading zero if required
    return ('0' + m).slice(-2);
  });
}

function genFormatTime() {
  return dateFormat(new Date(), '%Y%m%d_%H%M%S', false);
}

module.exports = {
  genSessionID,
  genFormatTime
};
