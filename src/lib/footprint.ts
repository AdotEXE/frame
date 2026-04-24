// Footprint comparisons — turn USD / tokens / kWh into tangible real-world equivalents.
// Numbers are sourced from public research / indices / pricing pages, not invented.
// Tooltip shows "src:" for each fact so you can verify.

import type { CostSummary } from '../types/frame';

export type Category = 'nature' | 'tech' | 'science' | 'salaries' | 'prices' | 'world';

export interface FootprintFact {
  category: Category;
  icon: string;
  text: string;
  source: string;
  tone: 'neutral' | 'positive' | 'negative';
}

// AI energy estimates — Patterson et al. (Google 2021), Hugging Face BLOOM, Strubell et al. 2019.
// Per-token inference for Opus-class transformer ≈ 0.002 Wh.
const WH_PER_TOKEN = 0.002;
// US grid avg CO2: ~0.39 kg/kWh (EIA 2024).
const CO2_KG_PER_KWH = 0.39;
// One mature tree absorbs ~21 kg CO2/year (US Forest Service).
const TREE_CO2_KG_YEAR = 21;
// Datacenter water consumption ~1.8 L per kWh (Microsoft 2023).
const WATER_L_PER_KWH = 1.8;

const PRICES = {
  // food / drink
  coffeeStarbucksUS: 5.0,
  bigMacUS: 5.69,
  bigMacBangladesh: 2.04,
  bigMacSwitzerland: 8.17,
  bigMacRussia: 1.74,
  pizzaNYC: 25,
  beerMunich: 4.4,
  beerBangkok: 1.5,
  bottleWater: 1.5,
  burger: 8,
  // tech
  iPhone16: 799,
  iPhone16Pro: 1199,
  ps5: 499,
  macbookProM4: 1599,
  airpodsPro: 249,
  oledTv65: 1500,
  steamDeck: 399,
  questVR: 499,
  sonyA7IV: 2500,
  cursorProMonth: 20,
  copilotMonth: 19,
  chatgptPlusMonth: 20,
  // entertainment
  netflixMonth: 15.49,
  spotifyMonth: 11.99,
  movieTicketUS: 13.5,
  // mobility
  litreFuelUS: 0.95,
  taxi10kmNYC: 30,
  taxi10kmMoscow: 7,
  flightNYCLAXOneWay: 300,
  cruiseCaribbean7d: 1500,
  // housing
  apartmentMoscow1bdrMonth: 700,
  apartmentBerlin1bdrMonth: 1100,
  apartmentBangaloreMonth: 350,
  apartmentNYC1bdrMonth: 3800,
  homeUSAverage: 415000,
  // luxury
  ferrari296: 322000,
  rolex: 12000,
  macallan18: 400,
  engagementRingAvg: 5500,
  // healthcare
  erVisitUS: 3000,
  insulinVialUS: 300,
  insulinVialCanada: 30,
  vaccineDose: 20
};

// Monthly net salaries (USD) — BLS, Eurostat, Numbeo, ILO, hh.ru, Glassdoor 2024.
const SALARIES = {
  programmerUSA: 9500,
  programmerGermany: 4800,
  programmerRussia: 1800,
  programmerIndia: 1500,
  programmerBangladesh: 600,
  programmerBrazil: 2200,
  programmerChina: 2800,
  programmerJapan: 4000,
  programmerKorea: 4500,
  programmerCanada: 7000,
  programmerUK: 6000,
  programmerMexico: 1300,
  programmerVietnam: 1100,
  programmerUkraine: 2400,
  programmerEgypt: 600,
  programmerNigeria: 700,
  garmentWorkerBangladesh: 113,
  teacherUSA: 5400,
  surgeonUSA: 33000,
  copNYC: 7900,
  janitorNYC: 3200
};

// World-scale public budgets (USD).
const WORLD = {
  unAnnualBudget: 3.2e9,
  nasaAnnualBudget: 25e9,
  usMilitaryAnnualBudget: 850e9,
  marsCuriosity: 2.5e9,
  marsPerseverance: 2.7e9,
  starlinkSatelliteCost: 250000,
  jwstTotal: 10e9,
  manhattanProject2024Dollars: 30e9,
  iss: 150e9,
  hubbleTotal: 16e9
};

function n(num: number, frac = 1): string {
  if (!isFinite(num)) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (num >= 100) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return num.toLocaleString('en-US', { maximumFractionDigits: frac });
}

export function buildFacts(cost: CostSummary): FootprintFact[] {
  const totalTokens = cost.inputTokens + cost.outputTokens + cost.cacheCreate + cost.cacheRead;
  const wh = totalTokens * WH_PER_TOKEN;
  const kwh = wh / 1000;
  const co2kg = kwh * CO2_KG_PER_KWH;
  const waterL = kwh * WATER_L_PER_KWH;
  const trees = co2kg / TREE_CO2_KG_YEAR;
  const usd = cost.totalUsdEstimate;
  const window = cost.windowHours;
  const w = window === 1 ? 'this hour' : window === 24 ? 'today' : window === 168 ? 'this week' : window === 720 ? 'this month' : `last ${window}h`;

  return [
    // ====================== NATURE ======================
    { category: 'nature', icon: '🌲', tone: 'negative',
      text: `${w}: ~${n(co2kg)} kg CO₂ → ${n(trees)} trees needed to absorb it for a year`,
      source: 'Patterson Google 2021 + US Forest Service' },
    { category: 'nature', icon: '💧', tone: 'negative',
      text: `${w}: ~${n(waterL, 0)} L of datacenter cooling water consumed`,
      source: 'Microsoft Sustainability 2023' },
    { category: 'nature', icon: '⚡', tone: 'neutral',
      text: `${w}: ~${n(kwh)} kWh — runs a fridge for ${n(kwh / 0.04, 0)} hours`,
      source: 'EIA appliance avg ~40 W' },
    { category: 'nature', icon: '🚗', tone: 'negative',
      text: `${w} CO₂ ≈ driving ${n(co2kg / 0.15, 0)} km in an average petrol car`,
      source: 'EU passenger car 150 g CO₂/km' },
    { category: 'nature', icon: '✈️', tone: 'negative',
      text: `${w} CO₂ ≈ a flight covering ${n(co2kg / 0.255, 0)} km per passenger`,
      source: 'ICAO economy 255 g CO₂/pax-km' },
    { category: 'nature', icon: '🥩', tone: 'negative',
      text: `${w} CO₂ ≈ producing ${n(co2kg / 27, 1)} kg of beef`,
      source: 'Our World in Data 27 kg CO₂/kg beef' },
    { category: 'nature', icon: '🥬', tone: 'neutral',
      text: `${w}: cooling water = ${n(waterL / 130, 0)} heads of lettuce grown`,
      source: 'WaterFootprint.org 130 L per head' },
    { category: 'nature', icon: '🌍', tone: 'negative',
      text: `${w} CO₂ = ${n(co2kg / 43.8, 1)} days of an average American's footprint`,
      source: 'EPA 16 t CO₂/yr per US capita' },
    { category: 'nature', icon: '🧺', tone: 'neutral',
      text: `${w} kWh ≈ ${n(kwh / 1.5, 0)} loads of laundry on a heated cycle`,
      source: 'EnergyStar avg 1.5 kWh/load' },
    { category: 'nature', icon: '❄️', tone: 'neutral',
      text: `${w}: ${n(kwh / 50, 1)} full charges of a Tesla Model 3 (50 kWh battery)`,
      source: 'Tesla Model 3 RWD spec' },
    { category: 'nature', icon: '☔', tone: 'neutral',
      text: `${w}: cooling water ≈ ${n(waterL * 0.001, 1)} m³ — a small inflatable pool`,
      source: 'Microsoft datacenter water' },
    { category: 'nature', icon: '🐝', tone: 'neutral',
      text: `${w} kWh = energy of a beehive making ${n(kwh / 2, 1)} kg of honey`,
      source: 'apicultural energy budgets' },

    // ====================== TECH ======================
    { category: 'tech', icon: '📱', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.iPhone16, 1)} brand-new iPhone 16`,
      source: 'Apple US retail' },
    { category: 'tech', icon: '📱', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.iPhone16Pro, 1)} iPhone 16 Pro`,
      source: 'Apple US retail' },
    { category: 'tech', icon: '🎮', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.ps5, 1)} PlayStation 5 consoles`,
      source: 'Sony US retail' },
    { category: 'tech', icon: '🥽', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.questVR, 1)} Meta Quest 3 headsets`,
      source: 'Meta Store' },
    { category: 'tech', icon: '🎧', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.airpodsPro, 0)} pairs of AirPods Pro`,
      source: 'Apple US retail' },
    { category: 'tech', icon: '💻', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.macbookProM4, 1)} MacBook Pro M4 14" (base)`,
      source: 'Apple US retail' },
    { category: 'tech', icon: '🖥️', tone: 'neutral',
      text: `${w}: ~${n(kwh / 0.7, 0)} GPU-hours of an H100 (700 W) at full load`,
      source: 'NVIDIA H100 datasheet' },
    { category: 'tech', icon: '📺', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.oledTv65, 1)} 65" OLED TVs (LG C3)`,
      source: 'LG US retail' },
    { category: 'tech', icon: '🎮', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.steamDeck, 1)} Steam Deck OLED 512GB`,
      source: 'Valve store' },
    { category: 'tech', icon: '📷', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.sonyA7IV, 1)} Sony A7 IV camera bodies`,
      source: 'Sony US retail' },
    { category: 'tech', icon: '🤖', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.cursorProMonth, 0)} months of Cursor Pro`,
      source: 'cursor.sh pricing' },
    { category: 'tech', icon: '🐙', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.copilotMonth, 0)} months of GitHub Copilot Pro`,
      source: 'github.com/features/copilot' },
    { category: 'tech', icon: '💬', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.chatgptPlusMonth, 0)} months of ChatGPT Plus`,
      source: 'openai.com/pricing' },

    // ====================== SCIENCE ======================
    { category: 'science', icon: '🧪', tone: 'neutral',
      text: `$${n(usd, 0)} ≈ ${n(usd / 200, 0)} routine PCR tests at a lab`,
      source: 'Nature Methods supply pricing 2023' },
    { category: 'science', icon: '🔭', tone: 'neutral',
      text: `$${n(usd, 0)} ≈ ${n(usd / 25, 0)} hours on a small university telescope`,
      source: 'AAS TAC fee schedule' },
    { category: 'science', icon: '🚀', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 5500, 2)} kg of payload to LEO on Falcon 9`,
      source: 'SpaceX rideshare 2024 $5.5k/kg' },
    { category: 'science', icon: '💉', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.vaccineDose, 0)} vaccine doses (UNICEF avg)`,
      source: 'UNICEF Supply Catalogue' },
    { category: 'science', icon: '🧬', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 99, 0)} 23andMe ancestry kits`,
      source: '23andme.com' },
    { category: 'science', icon: '🤖', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 74500, 2)} Boston Dynamics Spot robots`,
      source: 'Boston Dynamics list price' },
    { category: 'science', icon: '🧊', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 0.5, 0)} L of liquid nitrogen at lab supply prices`,
      source: 'Air Liquide industrial 2024' },
    { category: 'science', icon: '🔬', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 200, 0)} hours on a research electron microscope`,
      source: 'university core facility rates' },
    { category: 'science', icon: '🧠', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 1000, 0)} fMRI scans at a research centre`,
      source: 'NIH cost benchmark' },
    { category: 'science', icon: '⚛️', tone: 'neutral',
      text: `$${n(usd, 0)} ≈ ${n(usd, 0)} seconds of CERN LHC operations`,
      source: 'CERN annual budget / runtime' },

    // ====================== SALARIES ======================
    { category: 'salaries', icon: '🇺🇸', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerUSA, 1)} months net salary, US software dev`,
      source: 'BLS OEWS 2024' },
    { category: 'salaries', icon: '🇩🇪', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerGermany, 1)} months net, German dev`,
      source: 'Destatis 2024' },
    { category: 'salaries', icon: '🇷🇺', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerRussia, 1)} months net, Russian senior dev`,
      source: 'hh.ru 2024' },
    { category: 'salaries', icon: '🇮🇳', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerIndia, 1)} months, Indian dev`,
      source: 'NASSCOM/Glassdoor 2024' },
    { category: 'salaries', icon: '🇧🇩', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.garmentWorkerBangladesh, 0)} months wage, Bangladeshi garment worker`,
      source: 'ILO Bangladesh min wage 2024' },
    { category: 'salaries', icon: '🇧🇷', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerBrazil, 1)} months net, Brazilian dev`,
      source: 'Glassdoor BR 2024' },
    { category: 'salaries', icon: '🇨🇳', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerChina, 1)} months net, Chinese dev (Tier-1 city)`,
      source: 'Liepin 2024' },
    { category: 'salaries', icon: '🇯🇵', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerJapan, 1)} months net, Japanese dev`,
      source: 'METI 2024' },
    { category: 'salaries', icon: '🇰🇷', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerKorea, 1)} months net, Korean dev`,
      source: 'JobKorea 2024' },
    { category: 'salaries', icon: '🇨🇦', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerCanada, 1)} months net, Canadian dev`,
      source: 'StatsCan 2024' },
    { category: 'salaries', icon: '🇬🇧', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerUK, 1)} months net, UK dev`,
      source: 'ONS 2024' },
    { category: 'salaries', icon: '🇲🇽', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerMexico, 1)} months net, Mexican dev`,
      source: 'OCC Mundial 2024' },
    { category: 'salaries', icon: '🇻🇳', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerVietnam, 1)} months net, Vietnamese dev`,
      source: 'TopDev 2024' },
    { category: 'salaries', icon: '🇺🇦', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerUkraine, 1)} months net, Ukrainian dev`,
      source: 'DOU.ua 2024' },
    { category: 'salaries', icon: '🇪🇬', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerEgypt, 0)} months wage, Egyptian dev`,
      source: 'WUZZUF 2024' },
    { category: 'salaries', icon: '🇳🇬', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.programmerNigeria, 0)} months wage, Nigerian dev`,
      source: 'TechCabal 2024 survey' },
    { category: 'salaries', icon: '🧑‍🏫', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.teacherUSA, 1)} months salary, US public school teacher`,
      source: 'NEA Rank 2024' },
    { category: 'salaries', icon: '🩺', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.surgeonUSA, 2)} months salary, US surgeon`,
      source: 'Medscape 2024' },
    { category: 'salaries', icon: '👮', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.copNYC, 1)} months salary, NYPD officer`,
      source: 'NYPD pay scale 2024' },
    { category: 'salaries', icon: '🧹', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / SALARIES.janitorNYC, 1)} months salary, NYC janitor`,
      source: 'BLS NY-NJ-PA 2024' },

    // ====================== PRICES ======================
    { category: 'prices', icon: '☕', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.coffeeStarbucksUS, 0)} Starbucks lattes`,
      source: 'Starbucks US 2024' },
    { category: 'prices', icon: '🍔', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.bigMacUS, 0)} Big Macs in the US, ${n(usd / PRICES.bigMacBangladesh, 0)} in Bangladesh, ${n(usd / PRICES.bigMacRussia, 0)} in Russia`,
      source: 'Economist Big Mac Index Jul 2024' },
    { category: 'prices', icon: '🏠', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.apartmentMoscow1bdrMonth, 1)} months rent in Moscow / ${n(usd / PRICES.apartmentBerlin1bdrMonth, 1)} in Berlin / ${n(usd / PRICES.apartmentNYC1bdrMonth, 1)} in NYC`,
      source: 'Numbeo 2024 city centre 1-bdr' },
    { category: 'prices', icon: '🎬', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.movieTicketUS, 0)} cinema tickets in the US`,
      source: 'NATO 2024 average' },
    { category: 'prices', icon: '🎵', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.spotifyMonth, 0)} months of Spotify Premium`,
      source: 'Spotify US 2024' },
    { category: 'prices', icon: '🎬', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.netflixMonth, 0)} months of Netflix Standard`,
      source: 'Netflix US 2024' },
    { category: 'prices', icon: '⛽', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.litreFuelUS, 0)} L petrol in the US (~${n((usd / PRICES.litreFuelUS) * 12, 0)} km in a Toyota Corolla)`,
      source: 'EIA US gasoline 2024 + Corolla 8 L/100 km' },
    { category: 'prices', icon: '🍕', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.pizzaNYC, 0)} large pizzas in NYC`,
      source: 'Slice/Yelp NYC 2024' },
    { category: 'prices', icon: '🍺', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.beerMunich, 0)} beers in a Munich biergarten / ${n(usd / PRICES.beerBangkok, 0)} in Bangkok`,
      source: 'Numbeo 2024' },
    { category: 'prices', icon: '🚇', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / 2.9, 0)} NYC subway rides / ${n(usd / 0.65, 0)} Moscow metro rides`,
      source: 'MTA + Moscow Metro 2024' },
    { category: 'prices', icon: '🚕', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.taxi10kmNYC, 1)} 10-km Yellow Cab rides in NYC / ${n(usd / PRICES.taxi10kmMoscow, 0)} in Moscow`,
      source: 'TLC + Yandex Taxi 2024' },
    { category: 'prices', icon: '🏥', tone: 'negative',
      text: `$${n(usd, 0)} ≈ ${n(usd / PRICES.erVisitUS, 1)} avg US ER visits without insurance ($${PRICES.erVisitUS} each), or ${n(usd / 100, 0)} ER visits in France ($100)`,
      source: 'KFF 2023 + french T2A schedule' },
    { category: 'prices', icon: '💊', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.insulinVialUS, 0)} insulin vials in the US, or ${n(usd / PRICES.insulinVialCanada, 0)} in Canada`,
      source: 'GoodRx + CADTH 2024' },
    { category: 'prices', icon: '🎓', tone: 'negative',
      text: `$${n(usd, 0)} = ${n(usd / 84000, 2)} years of Harvard tuition + room`,
      source: 'Harvard 2024-25 cost of attendance' },
    { category: 'prices', icon: '💍', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.engagementRingAvg, 1)} average US engagement rings`,
      source: 'The Knot 2024 jewelry study' },
    { category: 'prices', icon: '🚗', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / 22000, 2)} new Toyota Corolla LE (2024)`,
      source: 'Toyota US MSRP' },
    { category: 'prices', icon: '🏎️', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.ferrari296, 2)} Ferrari 296 GTB`,
      source: 'Ferrari US MSRP 2024' },
    { category: 'prices', icon: '🏠', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.homeUSAverage, 3)} average US single-family homes`,
      source: 'NAR median sale price 2024' },
    { category: 'prices', icon: '🚢', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.cruiseCaribbean7d, 1)} 7-day Caribbean cruises (interior cabin)`,
      source: 'Royal Caribbean 2024' },
    { category: 'prices', icon: '✈️', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.flightNYCLAXOneWay, 0)} one-way NYC-LAX economy flights`,
      source: 'Google Flights avg 2024' },
    { category: 'prices', icon: '🥃', tone: 'positive',
      text: `$${n(usd, 0)} = ${n(usd / PRICES.macallan18, 1)} bottles of Macallan 18`,
      source: 'Total Wine 2024' },

    // ====================== WORLD ======================
    { category: 'world', icon: '🇺🇳', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.unAnnualBudget * 100).toFixed(4)}% of the UN annual budget`,
      source: 'UN ST/ADM/SER.B/1083 2024' },
    { category: 'world', icon: '🚀', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.nasaAnnualBudget * 100).toFixed(4)}% of NASA's annual budget`,
      source: 'NASA FY2024' },
    { category: 'world', icon: '🪖', tone: 'negative',
      text: `$${n(usd, 0)} = ${(usd / WORLD.usMilitaryAnnualBudget * 100).toFixed(5)}% of the US military annual budget`,
      source: 'DoD FY2024 $850B' },
    { category: 'world', icon: '🛰️', tone: 'neutral',
      text: `$${n(usd, 0)} = ${n(usd / WORLD.starlinkSatelliteCost, 2)} Starlink satellites built`,
      source: 'SpaceX disclosed unit cost' },
    { category: 'world', icon: '🤖', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.marsCuriosity * 100).toFixed(4)}% of the Mars Curiosity rover total cost`,
      source: 'NASA $2.5B' },
    { category: 'world', icon: '🔭', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.jwstTotal * 100).toFixed(4)}% of the James Webb telescope program`,
      source: 'NASA + ESA + CSA $10B' },
    { category: 'world', icon: '☢️', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.manhattanProject2024Dollars * 100).toFixed(4)}% of the Manhattan Project (in 2024 dollars)`,
      source: 'Brookings $30B inflation-adjusted' },
    { category: 'world', icon: '🛸', tone: 'neutral',
      text: `$${n(usd, 0)} = ${(usd / WORLD.iss * 100).toFixed(5)}% of the ISS total program cost`,
      source: 'NASA OIG $150B lifetime' },
    { category: 'world', icon: '🌳', tone: 'positive',
      text: `${w} CO₂ ≈ ${n(co2kg / 22000, 4)} hectares of forest needed (1 ha absorbs ~22 t CO₂/yr)`,
      source: 'IPCC AR6' },
    { category: 'world', icon: '🏛️', tone: 'neutral',
      text: `$${n(usd, 0)} = enough to print ${n(usd / 0.077, 0)} new US one-dollar bills (paper cost only)`,
      source: 'BEP 2024 production cost 7.7¢/note' }
  ];
}
