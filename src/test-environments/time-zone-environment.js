// Jest gives each test file a copy of process.env, so a test cannot change the time zone itself.
// This environment lets tests set TZ on the real worker process, which Node applies to Date immediately.
const { TestEnvironment } = require('jest-environment-jsdom');

class TimeZoneEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    const originalZone = process.env.TZ;
    const setTimeZone = (zone) => {
      if (zone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = zone;
      }
    };
    this.global.setTimeZone = setTimeZone;
    this.restoreTimeZone = () => setTimeZone(originalZone);
  }

  async teardown() {
    this.restoreTimeZone();
    await super.teardown();
  }
}

module.exports = TimeZoneEnvironment;
