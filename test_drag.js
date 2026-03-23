import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER_ERROR:', error.message));

    console.log("Navigating...");
    try {
        await page.goto('http://localhost:5200', { waitUntil: 'networkidle2' });
    } catch(e) {
        console.error("Local server not reachable:", e.message);
        process.exit(1);
    }

    console.log("Injecting session...");
    await page.evaluate(() => {
        const dummyJwt = "header.eyJleHAiOjk5OTk5OTk5OTl9.signature"; // {"exp": 9999999999}
        localStorage.setItem('auth_token', dummyJwt);
        localStorage.setItem('auth_user', JSON.stringify({ role: 'ADMIN', name: 'QA Tester', email: 'x@x.com' }));
    });
    
    await page.reload({ waitUntil: 'networkidle2' });
    console.log("Logged in.");

    // Enable Global Edit Mode
    console.log("Clicking Hand button...");
    await page.waitForFunction(() => document.querySelector('button[title*="Movimiento"],button[title*="Edición"]') !== null, { timeout: 15000 });
    await page.evaluate(() => {
        const btn = document.querySelector('button[title*="Movimiento"],button[title*="Edición"]');
        if(btn) btn.click();
        else console.error("Hand button not found!");
    });
    await new Promise(r => setTimeout(r, 500));

    console.log("Finding pallet 11...");
    await page.waitForSelector('g[data-id="11"]', { timeout: 15000 });
    const palletHandle = await page.$('g[data-id="11"]');
    if (!palletHandle) {
        console.error("Pallet 11 not found!");
        process.exit(1);
    }

    const box = await palletHandle.boundingBox();
    console.log("Pallet bounds:", box);

    // Initial state
    const t0 = await page.evaluate(el => el.getAttribute('transform'), palletHandle);
    console.log("Transform T0:", t0);

    console.log("Starting physical mouse drag...");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 100)); // wait for gesture start

    await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
    await new Promise(r => setTimeout(r, 200));

    const t1 = await page.evaluate(el => el.getAttribute('transform'), palletHandle);
    console.log("Transform T1 (during drag):", t1);

    await page.mouse.up();
    await new Promise(r => setTimeout(r, 200));

    const t2 = await page.evaluate(el => el.getAttribute('transform'), palletHandle);
    console.log("Transform T2 (after drop):", t2);

    await browser.close();
    console.log("Test finished.");
})();
