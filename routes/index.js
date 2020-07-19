const express = require('express');
const router = express.Router();
const fs = require("fs");
const puppeteer = require('puppeteer');
const excelToJson = require('convert-excel-to-json');
const nodeXlsx = require('node-xlsx');

const BASE_URL_INSTAGRAM = 'https://www.instagram.com/';
let account = null;

async function getmedias(username, end_cursor) {
    const usernameLogin = 'hoa.ronal';
    const password = 'Quanghoa1993';

    const BROWSER = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    });
    const PAGE = await BROWSER.newPage();

    await PAGE.goto(`${BASE_URL_INSTAGRAM}accounts/login/`);
    await PAGE.waitForSelector('input[name="username"]');
    await PAGE.type('input[name="username"]', usernameLogin);
    await PAGE.type('input[name="password"]', password);
    await PAGE.waitForSelector('button[type="submit"]');
    await PAGE.click('button[type="submit"]');
    await PAGE.waitFor(2000);

    account = usernameLogin;

    console.log(`${BASE_URL_INSTAGRAM}${username}/?__a=1`)

    await PAGE.goto(`${BASE_URL_INSTAGRAM}${username}/?__a=1`);
    let profile = await PAGE.evaluate(() => {
        return document.querySelector("body").innerText;
    });
    console.log('profile ===>>>:' + profile)
    const acc = JSON.parse(profile)['graphql']['user'];
    await PAGE.goto(`${BASE_URL_INSTAGRAM}graphql/query/?query_id=17880160963012870&id=${acc.id}&first=50&after=${end_cursor}`);
    let medias = await PAGE.evaluate(() => {
        return document.querySelector("body").innerText;
    });
    await PAGE.close();
    await BROWSER.close();
    console.log(medias)
    return JSON.parse(medias);
}

router.get('/', async function (req, res) {
    res.render('index', {title: 'Instagram Scraper'});
});

router.post('/export-excel', async function (req, res, next) {
    if (!req.files || Object.keys(req.files).length === 0) {
        res.send('No files were uploaded!');
    }
    const start_date = req.body.published_date;
    const max_like = req.body.max_like;
    console.log(req.files.file_data);

    let sampleFile = req.files.file_data;
    console.log('Vào đây 1')
    await sampleFile.mv('./uploads/instagram.xlsx').then();
    console.log('Vào đây 2')
    let result = excelToJson({
        sourceFile: `./uploads/instagram.xlsx`,
        columnToKey: {
            A: 'STT',
            B: 'URL_PROFILE'
        }
    });
    console.log('Vào đây 3')
    fs.unlink('./uploads/instagram.xlsx', function () {
        console.log('Delete file done.')
    });
    console.log('Vào đây 4')
    let dataExcel = [];
    let arrHeaderTitle = [];
    arrHeaderTitle.push('STT');
    arrHeaderTitle.push('Post Url');
    dataExcel.push(arrHeaderTitle);

    const profiles = result.profiles;
    let end_cursor = '';
    let username = '';

    for (let index = 0; index < profiles.length; index++) {
        const profile = profiles[index];
        let rowItemValue = [];
        username = profile.URL_PROFILE.replace(BASE_URL_INSTAGRAM, '');
        const data = await getmedias(username, end_cursor);
        console.log(data)
        Object.keys(profile).forEach(key => {
            rowItemValue.push(profile[key]);
        });
        dataExcel.push(rowItemValue);
    }

    const date = new Date(start_date);
    const milliseconds = date.getTime();
    const options = {'!cols': [{wch: 5}, {wch: 50}]};
    let buffer = nodeXlsx.build([{name: "List post", data: dataExcel}], options);
    res.attachment( `report_${milliseconds}.xlsx`);
    res.send(buffer);
});

module.exports = router;
