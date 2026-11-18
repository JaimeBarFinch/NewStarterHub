# Bar Finch new starter forms

A small website for onboarding new starters. You fill in the offer, it gives you a link, and the
starter completes and signs their paperwork on their own phone or computer. The finished forms are
PDFs that match the originals:

1. Statement of terms and conditions of employment: either the zero-hours contract or the standard
   contract with set weekly hours, whichever you choose for that starter
2. New Starter Form
3. HMRC starter checklist (the official form, filled in; only when it is needed)
4. Working time opt-out agreement (only if the starter chooses to opt out)
5. Confidentiality agreement

## The setup key

Starter links are signed. The starter page only opens links that were made with your **setup key**,
and refuses any link that was made without it or changed afterwards, so nobody else can create a
Bar Finch link and nobody can alter the pay, hours, contract type or delivery address in one.

The setup key is the line beginning `BFKEY1` in the separate `SETUP-KEY.txt` file. Keep it private
and never upload it to GitHub. The setup page asks for it the first time you use it in a browser.
If the key may have been seen by someone else, use **Replace the setup key** at the bottom of the
setup page.

## Try it before putting it online

Unzip the folder and open `setup.html` in Chrome or Edge, then enter your setup key. Everything
works from your own computer; links you create this way only open on that computer.

## Put it online with GitHub Pages

This is the same process as the Finch-Food app.

1. On GitHub, create a new repository, for example `starters`. It needs to be public for free
   GitHub Pages.
2. Choose **uploading an existing file** and drag in everything inside this folder: `index.html`,
   `setup.html`, `README.md` and the `assets` folder. Do not upload `SETUP-KEY.txt`. Commit.
3. Go to **Settings > Pages**. Under **Build and deployment** choose **Deploy from a branch**,
   branch `main`, folder `/ (root)`, then **Save**.
4. After a minute or two the site is live. Your setup page is
   `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/setup.html`. Bookmark it.

## Creating a link

1. Open the setup page. The first time in a browser, paste in your setup key.
2. Fill in the starter's name, job title, start date and hourly rate, then choose the contract:
   **Zero hours** (no weekly hours are asked for or shown anywhere) or **Set weekly hours** (type
   the hours in, and the standard contract is used with that figure).
3. The first time, add who signs for the company, draw their signature, and enter the email address
   completed forms should go to. These are saved in that browser, so use the same browser each time.
4. Select **Create link**, then copy the link (or the ready-made message) and send it to the starter.
5. **Download the contract as issued** gives you a copy of exactly what was offered.

Each link has a reference such as `Y8Z7-JALV`, worked out from the name, role, start date, pay and,
where they are set, the weekly hours. It is printed at the foot of every page the starter sends back, so you can match a returned
pack to its entry under **Links you have created**.

## What the starter does

They open the link, enter their details, bank details, right to work and tax answers, read and sign
the contract, choose whether to opt out of the 48 hour limit, and sign the confidentiality
agreement with a witness (or choose to sign it in person). At the end they download their forms and
send them to the email address you set.

Signing is done by ticking a box and typing their full name. Each signature shows the date and time.

## What is stored where

- The offer (name, role, pay, contract type, your signature) travels inside the link itself. Anyone with the
  link can open it, so send it only to the starter.
- The starter's answers stay in their own browser tab while they fill the forms in. Once they have
  downloaded their forms and sent them, the page deletes its copy of their answers automatically.
  Closing the tab also removes them. Nothing is sent to GitHub.
- The page counts the forms as sent when the phone's share sheet finishes, when automatic delivery
  is confirmed, or when the starter selects **I have sent my forms**. It cannot see inside their
  email app, and it does not touch the files they downloaded or the email itself.
- The setup page keeps your setup key, signature, email address and list of links in your browser
  only.
- The website's files are public, including the wording of the contract and confidentiality
  agreement. No personal details are in them. If you would rather the wording were not public,
  GitHub Pages from a private repository needs a paid GitHub plan.

## Automatic delivery (optional, set up later)

On the setup page, **Automatic delivery address** is empty to begin with. Once you have a receiving
service, paste its address there. Every link created after that also sends the finished forms to it
when the starter completes them. The starter can still download their own copy.

The receiving service gets one HTTPS `POST` with a `text/plain` body containing JSON:

```json
{
  "app": "bar-finch-new-starter",
  "version": 1,
  "ref": "Y8Z7-JALV",
  "submittedAt": "2026-11-18T16:12",
  "employee": { "forenames": "…", "surname": "…", "email": "…", "mobile": "…" },
  "jobTitle": "Bartender",
  "startDate": "2026-12-01",
  "files": [ { "name": "Surname-Forename_Contract.pdf", "type": "application/pdf", "base64": "…" } ]
}
```

Each file is a PDF encoded as base64, usually under 200 KB. The service should save or email the
files and reply with status 200. For the starter to see "Your forms have been sent", the reply must
include the header `Access-Control-Allow-Origin: *`. Without it the forms still arrive, but the
starter is asked to send them by email as well.

Two services that fit:

- **Microsoft Power Automate**: a flow starting with *When an HTTP request is received* (set to
  *Anyone*), which creates each file in a SharePoint folder and emails you. That trigger needs a
  Power Automate Premium licence for the flow's owner.
- **Google Apps Script**: a free web app script that emails the files or saves them to Google Drive.

Treat the receiving address like a password. It is only ever put inside starter links, never in the
website's public files. Because links are signed, it cannot be swapped for a different address.

## Changing the wording or the logo

The wording lives in `assets/templates.js` and the logo in `assets/logo.js`. Small wording changes
can be made there directly. For anything larger, such as a salaried contract, a new clause or a new
form, the document layouts in `assets/docs.js` need changing too.
