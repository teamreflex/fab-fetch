import { chromium } from "playwright"
import { Log } from "../util"

const button = `[aria-label="See more information on About this app"]`
const modal = `[aria-label="Close about app dialog"]`
const version = `.reAt0`

/**
 * Fetches the latest Fab version from the Play Store.
 * @returns Promise<string>
 */
export const fetchFabVersion = async (): Promise<string> => {
  const url = process.env.FAB_PLAYSTORE
  if (!url) {
    Log.warning("No Play Store URL provided, falling back to environment")
    return process.env.FAB_VERSION as string
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const page = await context.newPage();
  await page.goto(url);

  // wait for the "About this app" button
  await page.waitForSelector(button, { timeout: 2500 })

  // click the button
  await page.locator(button).click()

  // wait for the modal
  await page.waitForSelector(modal, { timeout: 1000 })

  // fetch out the version text
  const versionText = await page.locator(version).nth(0).textContent()
  
  // close the browser
  await browser.close()

  if (versionText) {
    return versionText
  }

  Log.warning("Could not scrape app version, falling back to environment")
  return process.env.FAB_VERSION as string
}