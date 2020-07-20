const express = require('express');
const router = express.Router();
const fs = require("fs");
const puppeteer = require('puppeteer');
const excelToJson = require('convert-excel-to-json');
const nodeXlsx = require('node-xlsx');

const BASE_URL_INSTAGRAM = 'https://www.instagram.com/';
const POST_URL_INSTAGRAM = 'https://www.instagram.com/p/';
let account = null;
let browser = null;
let page = null;

async function login() {
    const usernameLogin = 'hoa.ronal';
    const password = 'Quanghoa1993';
    browser = await puppeteer.launch();
    page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login/');
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', usernameLogin);
    await page.type('input[name="password"]', password);
    await page.waitForSelector('button[type="submit"]');
    await page.waitFor(2000);
    await page.click('button[type="submit"]');
    await page.waitFor(2000);
}

async function getmedias(username, end_cursor) {
    await page.goto(`https://www.instagram.com/${username}/?__a=1`);
    let profile = await page.evaluate(() => {
        return document.querySelector("body").innerText;
    });
    const acc = JSON.parse(profile)['graphql']['user'];
    await page.goto(`https://www.instagram.com/graphql/query/?query_id=17880160963012870&id=${acc.id}&first=50&after=${end_cursor}`)
    let medias = await page.evaluate(() => {
        return document.querySelector("body").innerText;
    });

    return JSON.parse(medias);
}

async function close() {
    if (page)
        await page.close();
    if (browser)
        await browser.close();
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
    await sampleFile.mv('./uploads/instagram.xlsx').then();
    let result = excelToJson({
        sourceFile: `./uploads/instagram.xlsx`,
        columnToKey: {
            A: 'STT',
            B: 'URL_PROFILE'
        }
    });
    fs.unlink('./uploads/instagram.xlsx', function () {
        console.log('Delete file done.')
    });
    let dataExcel = [];
    let arrHeaderTitle = [];
    arrHeaderTitle.push('STT');
    arrHeaderTitle.push('Post Url');
    dataExcel.push(arrHeaderTitle);

    const profiles = result.profiles;
    let end_cursor = '';
    let username = '';

    await login();

    for (let index = 0; index < profiles.length; index++) {
        const profile = profiles[index];
        username = profile.URL_PROFILE
            .replace(BASE_URL_INSTAGRAM, '')
            .replace('/', '');

        let has_next_page = true;
        while (has_next_page) {
            const response = await getmedias(username, end_cursor);
            let page_info = response.data.user.edge_owner_to_timeline_media.page_info;
            let medias = response.data.user.edge_owner_to_timeline_media.edges;
            for (let i = 0; i < medias.length; i++) {
                let rowItemValue = [];
                let media = medias[i].node;
                if (media.edge_liked_by > max_like) {
                    rowItemValue.push(`${POST_URL_INSTAGRAM}${media.shortcode}`);
                    dataExcel.push(rowItemValue);
                }
            }
            end_cursor = page_info.end_cursor;
            has_next_page = page_info.has_next_page;
        }
    }

    await close();

    const date = new Date(start_date);
    const milliseconds = date.getTime();
    const options = {'!cols': [{wch: 5}, {wch: 50}]};
    let buffer = nodeXlsx.build([{name: "List post", data: dataExcel}], options);
    res.attachment( `report_${milliseconds}.xlsx`);
    res.send(buffer);
});

module.exports = router;
