"use client";

import { useState, type FormEvent } from "react";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";

/**
 * Auth forms (D5/D10): call existing GraphQL mutations with credentials included.
 * Tokens are entered into a labelled field, never placed in a URL or query string.
 * Resend/forgot responses are neutral regardless of account existence.
 * PLACEHOLDER COPY (docs/16 §8 #6) on all user-visible strings.
 */

export type AuthKind = "register" | "login" | "verify-email" | "forgot-password" | "reset-password";

type Field = { name: string; label: string; type: string; required: boolean };

const FIELDS: Record<AuthKind, Field[]> = {
  register: [
    { name: "email", label: "Email", type: "email", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
    { name: "password", label: "Password", type: "password", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
  ],
  login: [
    { name: "email", label: "Email", type: "email", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
    { name: "password", label: "Password", type: "password", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
  ],
  "verify-email": [
    { name: "token", label: "Verification token", type: "text", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
  ],
  "forgot-password": [
    { name: "email", label: "Email", type: "email", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
  ],
  "reset-password": [
    { name: "token", label: "Reset token", type: "text", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
    { name: "newPassword", label: "New password", type: "password", required: true }, // PLACEHOLDER COPY (docs/16 §8 #6)
  ],
};

const MUTATIONS: Record<AuthKind, string> = {
  register: `mutation($input: RegisterInput!) { register(input: $input) { ok message } }`,
  login: `mutation($input: LoginInput!) { login(input: $input) { ok message } }`,
  "verify-email": `mutation($token: String!) { verifyEmail(token: $token) { ok message } }`,
  "forgot-password": `mutation($email: String!) { requestPasswordReset(email: $email) { ok message } }`,
  "reset-password": `mutation($input: ResetPasswordInput!) { resetPassword(input: $input) { ok message } }`,
};

const NEUTRAL = "If the details are valid, you will receive an email shortly."; // PLACEHOLDER COPY (docs/16 §8 #6)

export default function AuthForm({ kind }: { kind: AuthKind }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const enumerationSafe = kind === "forgot-password" || kind === "verify-email";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let variables: Record<string, unknown>;
    if (kind === "register" || kind === "login" || kind === "reset-password") {
      variables = { input: values };
    } else if (kind === "verify-email") {
      variables = { token: values.token };
    } else {
      variables = { email: values.email };
    }
    const result = await gql(MUTATIONS[kind], variables);
    if (result.errors?.length) {
      setStatus(enumerationSafe ? NEUTRAL : messageForError(result.errors[0].message));
      return;
    }
    setStatus(enumerationSafe ? NEUTRAL : "Done. You can continue."); // PLACEHOLDER COPY (docs/16 §8 #6)
  }

  return (
    <form className="card" onSubmit={submit}>
      {FIELDS[kind].map((field) => (
        <div key={field.name}>
          <label htmlFor={`auth-${field.name}`}>{field.label}</label>
          <input
            id={`auth-${field.name}`}
            name={field.name}
            type={field.type}
            required={field.required}
            value={values[field.name] || ""}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
          />
        </div>
      ))}
      <button type="submit">Continue</button> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      {kind === "forgot-password" ? (
        <>
          {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <button
            type="button"
            onClick={() => {
              void gql(`mutation($email: String!) { resendVerification(email: $email) { ok message } }`, { email: values.email });
              setStatus(NEUTRAL);
            }}
          >
            Resend verification email
          </button>
        </>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
