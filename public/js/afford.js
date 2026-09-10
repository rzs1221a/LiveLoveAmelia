/* Affordability: work backward from a comfortable monthly payment to a price range. */
import { $, fmt, countTo } from './core.js';
import { BANDS } from './data.js';

(function () {
  const mo = $('#afMo'); if (!mo) return;
  const out = $('#afMoOut'), rate = $('#afRate'), down = $('#afDown'), tax = $('#afTax'), ins = $('#afIns'), hoa = $('#afHoa');
  const price = $('#afPrice'), range = $('#afRange'), bar = $('#afBar'), legend = $('#afLegend'), bands = $('#afBands'), askBtn = $('#afAsk');
  const num = (el, dflt) => { const v = parseFloat(el.value); return Number.isFinite(v) ? v : dflt; };

  function calc() {
    const monthly = num(mo, 5000);
    const r = num(rate, 6.5) / 1200;
    const dp = Math.min(Math.max(num(down, 20), 0), 80) / 100;
    const carry = (Math.max(num(tax, 1), 0) + Math.max(num(ins, .9), 0)) / 1200;
    const dues = Math.max(num(hoa, 150), 0);
    out.textContent = fmt(monthly);

    const k = r > 0 ? r / (1 - Math.pow(1 + r, -360)) : 1 / 360;   /* monthly P&I per dollar financed */
    const budget = monthly - dues;
    if (budget <= 0) {
      price.textContent = '—';
      range.textContent = 'Dues alone use up that payment — try a higher number.';
      bands.innerHTML = ''; legend.innerHTML = '';
      return;
    }
    const P = budget / ((1 - dp) * k + carry);
    const lo = P * 0.93, hi = P * 1.07;
    countTo(price, P, v => fmt(Math.round(v / 1000) * 1000));
    range.textContent = `home — call it ${fmt(Math.round(lo / 10000) * 10000)} to ${fmt(Math.round(hi / 10000) * 10000)}`;

    const pi = P * (1 - dp) * k, ti = P * carry;
    const total = pi + ti + dues;
    bar.querySelector('.pi').style.flexGrow = pi / total;
    bar.querySelector('.ti').style.flexGrow = ti / total;
    bar.querySelector('.ho').style.flexGrow = dues / total || 0.0001;
    legend.innerHTML = [['pi', 'Principal & interest', pi], ['ti', 'Taxes & insurance', ti], ['ho', 'HOA / dues', dues]]
      .map(([c, l, v]) => `<li class="${c}"><i></i>${l} <b>${fmt(v)}</b></li>`).join('');

    bands.innerHTML = BANDS.map(bnd => {
      const hit = hi >= bnd.lo && lo < bnd.hi;
      return `<li class="${hit ? 'on' : ''}"><b>${bnd.label}</b><span>${bnd.areas.join(' · ')}</span></li>`;
    }).join('');

    if (askBtn) askBtn.dataset.ask = `I can spend about ${fmt(monthly)} a month, at ${num(rate, 6.5)}% with ${Math.round(dp * 100)}% down — roughly ${fmt(lo)} to ${fmt(hi)}. What does that buy on Amelia Island, and where should I be looking?`;
  }

  [mo, rate, down, tax, ins, hoa].forEach(el => { el.addEventListener('input', calc); el.addEventListener('change', calc); });
  calc();
})();
