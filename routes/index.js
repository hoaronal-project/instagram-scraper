const express = require('express');
const router = express.Router();
const fs = require("fs");
const puppeteer = require('puppeteer');
const excelToJson = require('convert-excel-to-json');

router.get('/fetch-medias', async function(req, res) {
  const username = req.query.username;
  const end_cursor = req.query.end_cursor;
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.instagram.com/accounts/login/');
  await page.waitForSelector('input[name="username"]');
  await page.type('input[name="username"]', 'doanquanghoaaa');
  await page.type('input[name="password"]', 'Quanghoa1993');
  await page.waitForSelector('button[type="submit"]');
  await page.waitFor(2000);
  await page.click('button[type="submit"]');
  await page.waitFor(2000);

  await page.goto(`https://www.instagram.com/${username}/?__a=1`);
  let profile = await page.evaluate(() => {
    return JSON.parse(document.querySelector("body").innerText);
  });
  const acc = profile['graphql']['user'];
  await page.goto(`https://www.instagram.com/graphql/query/?query_id=17880160963012870&id=${acc.id}&first=50&after=${end_cursor}`)
  let medias = await page.evaluate(() => {
    return JSON.parse(document.querySelector("body").innerText);
  });
  await browser.close();
  res.json(medias);
});

router.get('/', async function(req, res) {

  res.render('index', {title: 'Instagram Scraper'});
});

router.post('/export-excel', async function(req, res, next) {
  if (req.files) {
    console.log('có file')
  }
  if (!req.files || Object.keys(req.files).length === 0) {
    res.render('index', {title: 'Instagram Scraper', message: 'No files were uploaded!'});
  }
  const start_date = req.body.published_date;
  const max_like = req.body.max_like;
  console.log(req.files.file_data);

  let sampleFile = req.files.file_data;
  await sampleFile.mv('./uploads/instagram.xlsx', function (err) {
    if (err)
      res.render('index', {title: 'Instagram Scraper', message: err});
    res.render('index', {title: 'Instagram Scraper', message: 'File uploaded'});
  });
  const result = excelToJson({
    sourceFile: `./uploads/instagram.xlsx`
  });
  console.log(result);
  const date = new Date(start_date);
  const milliseconds = date.getTime();
  console.log(milliseconds);


  res.render('index', {title: 'Instagram Scraper'});
});

module.exports = router;
