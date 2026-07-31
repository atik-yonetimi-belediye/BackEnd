const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setAuthCookies,
  clearAuthCookies,
  getCookieToken,
  isValidCsrfRequest,
} = require("../../src/utils/authCookies");

test("auth cookie HttpOnly, CSRF cookie ise JavaScript tarafından okunabilir ayarlanır", () => {
  const written = [];
  const cleared = [];
  const response = {
    cookie: (name, value, options) => written.push({ name, value, options }),
    clearCookie: (name, options) => cleared.push({ name, options }),
  };

  setAuthCookies(response, "signed-token");
  assert.equal(written[0].name, "auth_token");
  assert.equal(written[0].options.httpOnly, true);
  assert.equal(written[1].name, "csrf_token");
  assert.equal(written[1].options.httpOnly, false);
  assert.equal(written[0].options.sameSite, "strict");

  const csrfToken = written[1].value;
  const request = {
    headers: {
      cookie: `auth_token=signed-token; csrf_token=${csrfToken}`,
    },
    get: (name) => (name === "x-csrf-token" ? csrfToken : undefined),
  };
  assert.equal(getCookieToken(request), "signed-token");
  assert.equal(isValidCsrfRequest(request), true);

  request.get = () => "wrong-token";
  assert.equal(isValidCsrfRequest(request), false);

  clearAuthCookies(response);
  assert.deepEqual(
    cleared.map((item) => item.name),
    ["auth_token", "csrf_token"]
  );
});
