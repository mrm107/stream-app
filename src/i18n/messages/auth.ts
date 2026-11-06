import type { Msg } from "..";

// Log in / sign up: phone + one-time code, and the older password login.
// en must have every key fa has.
const fa = {
  loginTitle: "ورود به Stream",
  joinTitle: "به Stream بپیوندید",
  login: "ورود",
  signup: "ثبت‌نام",
  identifier: "نام کاربری یا ایمیل",
  password: "رمز عبور",
  loggingIn: "در حال ورود…",
  noPassword: "رمز عبور ندارید؟",
  loginWithPhone: "با شماره‌ی موبایل وارد شوید",
  phone: "شماره‌ی موبایل",
  code: "کد تأیید",
  codeSent: "کد {n} رقمی به این شماره پیامک شد.",
  displayName: "نام نمایشی",
  optional: "(اختیاری)",
  wait: "لطفاً صبر کنید…",
  sendCode: "ارسال کد",
  resendIn: "ارسال دوباره‌ی کد تا {n} ثانیه‌ی دیگر",
  resend: "ارسال دوباره‌ی کد",
  changeNumber: "تغییر شماره",
  olderAccount: "حساب قدیمی دارید؟",
  loginWithPassword: "با رمز عبور وارد شوید",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  loginTitle: "Log in to Stream",
  joinTitle: "Join Stream today",
  login: "Log In",
  signup: "Sign Up",
  identifier: "Username or email",
  password: "Password",
  loggingIn: "Logging in…",
  noPassword: "No password?",
  loginWithPhone: "Log in with your mobile number",
  phone: "Mobile number",
  code: "Code",
  codeSent: "We texted a {n}-digit code to this number.",
  displayName: "Display name",
  optional: "(optional)",
  wait: "Please wait…",
  sendCode: "Send code",
  resendIn: "Resend code in {n}s",
  resend: "Resend code",
  changeNumber: "Change number",
  olderAccount: "Have an older account?",
  loginWithPassword: "Log in with a password",
};

export default { fa, en };
