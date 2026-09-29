import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push";

// The endpoint is a URL the server will POST to on every alert, so the
// allow-list is the difference between a push subscription and a request
// forged in someone else's name.
describe("isAllowedPushEndpoint", () => {
  it("accepts the endpoints the four browser push services hand out", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://web.push.apple.com/QGxV2u",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("refuses anything else, however push-shaped", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.attacker.example/fcm/send/abc",
      "https://attacker.example/?fcm.googleapis.com/",
      "https://push.apple.com.evil.example/x",
      "https://evilpush.apple.com/x",
      "https://notify.windows.com",
      "https://example.com/hook",
      "",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });
});
