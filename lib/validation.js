// Sign-up rules. Keep in sync with the worker (api/src/index.js), which
// enforces the same rules on the server.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 3–30 letters, numbers, dots or underscores
export const USERNAME_RE = /^[A-Za-z0-9._]{3,30}$/;

export const PASSWORD_MIN_LENGTH = 9;

// Each rule has a key for its translated label (auth.passwordRules.<key>)
export const PASSWORD_RULES = [
  { key: "length", test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", test: (value) => /[A-Z]/.test(value) },
  { key: "number", test: (value) => /[0-9]/.test(value) },
  { key: "symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export const isStrongPassword = (value) => PASSWORD_RULES.every((rule) => rule.test(value));

export const normalizeEmail = (value) => value.trim().toLowerCase();
