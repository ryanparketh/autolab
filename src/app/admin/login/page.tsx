import { Logo } from "@/components/Logo";
import { ActionForm } from "../ActionForm";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-20">
      <div className="card w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Shop admin</h1>
        <ActionForm action={loginAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Sign in
          </button>
        </ActionForm>
      </div>
    </main>
  );
}
