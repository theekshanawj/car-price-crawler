const fs = require("fs");
const puppeteer = require("puppeteer");

const MAX_PRICE = Number(process.env.maxPrice);
const CAR = process.env.car;
const PAGES = Number(process.env.pages || 10);

// replace Rs. and , from price
const extractPrice = (priceLabel) => {
  return Number(priceLabel.replace(/Rs. |,/g, ""));
};

const filterCriteria = (element) => {
  return element.price <= MAX_PRICE;
  //return true;
};

const sanitizeData = (data) => {
  return data.map((element) => {
    const { price, adPublished, ...rest } = element;
    return {
      ...rest,
      price: extractPrice(price),
      priceLabel: price,
      adPublished: new Date(adPublished),
    };
  });
};

const getVehicleInfo = async (page, url) => {
  console.log(url);
  await page.goto(url);

  const value = await page.evaluate(() => {
    const getInnerHtml = (element) => {
      return element && element.innerHTML && element.innerHTML.trim();
    };
    const cars = document.getElementsByClassName("item");

    const items = [];

    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      const href = car.getElementsByTagName("a")[0];
      const type = getInnerHtml(href);
      const link = href && href.href;

      const properties = car.getElementsByClassName("boxintxt");

      items.push({
        type,
        location: getInnerHtml(properties[0]),
        price: getInnerHtml(properties[1]),
        distance: getInnerHtml(properties[2]),
        adPublished: getInnerHtml(properties[3]),
        link,
      });
      console.log(items);
    }
    return items;
  });

  return value;
};

const addToGroup = (group, key, value) => {
  if (group[key]) {
    group[key].push(value);
  } else {
    group[key] = [value];
  }
};

const reduceByPublishedDay = (prev, current) => {
  const { adPublished } = current;
  const differenceInTimeInDays =
    (new Date().getTime() - adPublished.getTime()) / (1000 * 3600 * 24);
  if (differenceInTimeInDays < 2) {
    addToGroup(prev, "Ad published < 2 days", current);
  } else if (differenceInTimeInDays >= 2 && differenceInTimeInDays < 4) {
    addToGroup(prev, "Ad published >= 2 && < 4 days", current);
  } else {
    addToGroup(prev, "Ad published > 4 days", current);
  }
};

const reduceByManufacturedYear = (prev, current) => {
  const { type } = current;
  if (type.includes("2022")) {
    addToGroup(prev, "2022", current);
  } else if (type.includes("2021")) {
    addToGroup(prev, "2021", current);
  } else if (type.includes("2020")) {
    addToGroup(prev, "2020", current);
  } else if (type.includes("2019")) {
    addToGroup(prev, "2019", current);
  } else if (type.includes("2018")) {
    addToGroup(prev, "2018", current);
  } else if (type.includes("2017")) {
    addToGroup(prev, "2017", current);
  } else if (type.includes("2016")) {
    addToGroup(prev, "2016", current);
  } else if (type.includes("2015")) {
    addToGroup(prev, "2015", current);
  } else if (type.includes("2014")) {
    addToGroup(prev, "2014", current);
  } else if (type.includes("2013")) {
    addToGroup(prev, "2013", current);
  } else if (type.includes("2012")) {
    addToGroup(prev, "2012", current);
  } else if (type.includes("2011")) {
    addToGroup(prev, "2011", current);
  } else if (type.includes("2010")) {
    addToGroup(prev, "2010", current);
  } else if (type.includes("2009")) {
    addToGroup(prev, "2009", current);
  } else if (type.includes("2008")) {
    addToGroup(prev, "2008", current);
  } else if (type.includes("2007")) {
    addToGroup(prev, "2007", current);
  } else {
    addToGroup(prev, "uncategorized", current);
  }
};

const groupByPublishedDay = (filteredData) => {
  const group = {};

  filteredData.reduce((prev, current) => {
    reduceByPublishedDay(prev, current);
    return prev;
  }, group);

  const groupByYear = {};

  Object.keys(group).forEach((g) => {
    const items = group[g];
    const yearGroup = {};

    items.reduce((prev, current) => {
      reduceByManufacturedYear(prev, current);
      return prev;
    }, yearGroup);

    groupByYear[g] = yearGroup;
  });
  return groupByYear;
};

const groupManufacturedYear = (filteredData) => {
  const group = {};

  filteredData.reduce((prev, current) => {
    reduceByManufacturedYear(prev, current);
    return prev;
  }, group);

  const groupByDate = {};

  Object.keys(group).forEach((g) => {
    const items = group[g];
    const yearDate = {};

    items.reduce((prev, current) => {
      reduceByPublishedDay(prev, current);
      return prev;
    }, yearDate);

    groupByDate[g] = yearDate;
  });
  return groupByDate;
};

(async () => {
  const browser = await puppeteer.launch({
    channel: "chrome",
    headless: true,
  });
  const page = await browser.newPage();

  const url = `https://riyasewana.com/search/cars/${CAR}`;

  const maxPageCount = PAGES;
  const data = [];
  for (let i = 1; i <= maxPageCount; i += 1) {
    let pageData;
    if (i === 1) {
      pageData = await getVehicleInfo(page, url);
    } else {
      pageData = await getVehicleInfo(page, `${url}?page=${i}`);
    }
    data.push(...pageData);
  }

  const sanitizedData = sanitizeData(data);

  const filteredData = sanitizedData.filter(filterCriteria);

  const groupByYear = groupManufacturedYear(filteredData);

  const groupByPublishedDate = groupByPublishedDay(filteredData);

  const formattedDate = new Intl.DateTimeFormat("en-US")
    .format(new Date())
    .replace(/\//g, "-");

  const fileName = `./${CAR}-${formattedDate}.json`;

  fs.writeFileSync(
    fileName,
    JSON.stringify(
      { groupByYear, groupByPublishedDate, timestamp: new Date() },
      null,
      "\t"
    )
  );

  browser.close();
})();
