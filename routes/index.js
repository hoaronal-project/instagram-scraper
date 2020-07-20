const express = require('express');
const router = express.Router();
const fs = require("fs");
const puppeteer = require('puppeteer');
const excelToJson = require('convert-excel-to-json');
const nodeXlsx = require('node-xlsx');

const BASE_URL_INSTAGRAM = 'https://www.instagram.com/';
const POST_URL_INSTAGRAM = 'https://www.instagram.com/p/';
let account = null;
let password = null;
let browser = null;
let page = null;

async function login() {
    if (!browser) {
        browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);
        page.setDefaultTimeout(0);

        await page.goto('https://www.instagram.com/accounts/login/');
        await page.waitForSelector('input[name="username"]');
        await page.type('input[name="username"]', account);
        await page.type('input[name="password"]', password);
        await page.waitForSelector('button[type="submit"]');
        await page.waitFor(2000);
        await page.click('button[type="submit"]');
        await page.waitFor(2000);
        await page.pdf({path: 'page.pdf', format: 'A4'})
    }
}

async function getmedias(username, end_cursor) {
    await page.goto(`https://www.instagram.com/${username}/?__a=1`);
    let profile = await page.evaluate(() => {
        return document.querySelector("body").innerText;
    });
    const acc = JSON.parse(profile)['graphql']['user'];
    await page.goto(`https://www.instagram.com/graphql/query/?query_id=17880160963012870&id=${acc.id}&first=50&after=${end_cursor}`)
    await page.waitFor(1000);
    let medias = await page.evaluate(() => {
        return document.querySelector("body").innerText;
    });
    return JSON.parse(medias);
}

async function close() {
    account = null;
    if (page)
        await page.close();
    if (browser)
        await browser.close();
}

router.get('/', async function (req, res) {
    if (account)
        res.render('index', {title: 'Instagram Scraper'});
    else
        res.render('login', {title: 'Login Instagram'});
});

router.post('/login', async function (req, res) {
    account = req.body.username;
    password = req.body.password;
    await login();
    res.redirect('/')
});

router.post('/export-excel', async function (req, res, next) {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            res.send('No files were uploaded!');
        }
        let max_like = 0;
        let max_comment = 0;
        let published_date = '1970/01/01';

        if (req.body.published_date)
            published_date = req.body.published_date;
        if (req.body.max_like)
            max_like = req.body.max_like;
        if (req.body.max_comment)
            max_comment = req.body.max_comment;

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
        arrHeaderTitle.push('Like number');
        arrHeaderTitle.push('Comment number');
        arrHeaderTitle.push('Post Url');
        dataExcel.push(arrHeaderTitle);

        const profiles = result.profiles;
        let end_cursor = '';
        let username = '';

        const date = new Date(published_date);
        const milliseconds = date.getTime() / 1000;
        for (let index = 0; index < profiles.length; index++) {
            const profile = profiles[index];
            username = profile.URL_PROFILE
                .replace(BASE_URL_INSTAGRAM, '')
                .replace('/', '');

            let has_next_page = true;
            try {
                while (has_next_page) {
                    const response = await getmedias(username, end_cursor);
                    let page_info = response.data.user.edge_owner_to_timeline_media.page_info;
                    let medias = response.data.user.edge_owner_to_timeline_media.edges;
                    for (let i = 0; i < medias.length; i++) {
                        let rowItemValue = [];
                        let media = medias[i].node;

                        if (media.edge_liked_by.count >= parseInt(max_like) && media.taken_at_timestamp >= milliseconds
                            && media.edge_media_to_comment.count >= parseInt(max_comment)) {
                            rowItemValue.push(`${media.edge_liked_by.count}`);
                            rowItemValue.push(`${media.edge_media_to_comment.count}`);
                            rowItemValue.push(`${POST_URL_INSTAGRAM}${media.shortcode}`);
                            dataExcel.push(rowItemValue);
                        }
                    }
                    end_cursor = page_info.end_cursor;
                    has_next_page = page_info.has_next_page;
                }
            } catch (e) {
                console.log('Error when extract data ===>>>: ' + e)
            }
            end_cursor = '';
        }

        const options = {'!cols': [{wch: 15}, {wch: 15}, {wch: 50}]};
        console.log('dataExcel ===>>:' + dataExcel.length);
        let buffer = nodeXlsx.build([{name: "List post", data: dataExcel}], options);
        res.attachment(`report_${new Date().getTime()}.xlsx`);
        res.send(buffer);
    } catch (e) {
        console.log('Error message ===> :' + e)
        res.redirect('/');
    }
});

module.exports = router;
