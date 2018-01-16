#!/usr/bin/env node

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const cwd = process.env.PWD;

const cmdPath = '/usr/local/bin/gh-pr';

if (!fs.existsSync(cmdPath)) {
  fs.symlink(__filename, cmdPath, err => {
    if (err) console.error(err);
  });
}

// ADD YOUR OWN OAUTH TOKEN HERE
const OAuthToken = '';
let tokenError = OAuthToken || new Error('add your token above the following line');

if (tokenError instanceof Error) {
  console.error('Create OAuth token with \"repo\" permissions at the link below:');
  console.error('https://github.com/settings/tokens/new\n');
  console.error(tokenError);
  process.exit(1);
}

const title = fs
  .readFileSync(path.join(cwd, '/.git/HEAD'), { encoding: 'utf8' })
  .replace('ref: refs/heads/', '').replace('\n', '');

// this could be written better
const rawGitConfig = fs
    .readFileSync(path.join(cwd, '/.git/config'), { encoding: 'utf8' })
    .split('\n')
    .filter(ln => ln.includes('='))
    .map(ln => ln.slice(1).split(' = '));

const gitConfig = new Map();

rawGitConfig.forEach(([key, value]) => {
  if (!gitConfig.has(key)) gitConfig.set(key, value);
});

// this could be a little cleaner too
const repo = gitConfig
  .get('url')
  .replace(/.*\:/, '')
  .replace('.git', '');

let bodyText = '';

// would be better to properly check for the template
try {
  bodyText += fs
    .readFileSync(path.join(cwd, '.github/PULL_REQUEST_TEMPLATE.md'), {
      encoding: 'utf8'
    });
} catch (err) {
  console.error('~no-template~');
}

const [execPath, jsFilePath, base, ...other] = process.argv;
if (!base) {
  console.error(`base branch specified: ${base}`);
  process.exit(1);
}

// post body
const body = buildBody(title, bodyText, base);
// options for https request
const options = buildOptions(body);

openPullRequest(body, options);

if (other) {
  other.forEach(base => {
    const body = buildBody(title, bodyText, base);
    const options = buildOptions(body);
    openPullRequest(body, options);
  });
}


function buildBody(title, bodyText, base) {
  return JSON.stringify({
    title: title,
    head: title,
    body: bodyText,
    base: base
  });
}

function buildRequestOptions(body) {
  return {
    hostname: 'api.github.com',
    port: 443,
    method: 'POST',
    path: `/repos/${repo}/pulls`,
    headers: {
      'user-agent': 'pring',
      Authorization: `token ${OAuthToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
  };
}

function openPullRequest(body, options) {
  const req = https.request(options, res => {
    console.log(res.statusCode);
    res.setEncoding('utf8');

    let data = '';
    res.on('data', chunk => {
      data += chunk;
    });

    res.on('end', () => {
      let responseObj = JSON.parse(data);

      if (responseObj.html_url) {
        console.log(responseObj.html_url);
      } else {
        console.log(`options:\n${JSON.stringify(options)}`);
        console.log(`body:\n${body}`);
        console.dir(responseObj);
      }
    });
  });

  req.on('error', console.error);

  req.write(body);

  req.end();
}
