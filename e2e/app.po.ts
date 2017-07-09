import { browser, element, by } from 'protractor';

export class TmpPage {
  navigateTo() {
    return browser.get('/');
  }

  getParagraphText() {
    return element(by.css('gk-root h1')).getText();
  }
}
