"use client";

import { useState, type FormEvent } from "react";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";
import Field from "./ui/Field";
import Button from "./ui/Button";

const CREATE_PROFILE = `mutation($input: SellerProfileInput!) { createSellerProfile(input: $input) { id } }`;
const SUBMIT_VERIFICATION = `mutation { submitSellerVerification { id status } }`;

/** Seller onboarding with the existing profile and verification mutations. */
export default function SellerProfileForm() {
  const [values, setValues] = useState({
    sellerType: "individual",
    displayName: "",
    publicStoreName: "",
    legalName: "",
    provinceCode: "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const input = {
        sellerType: values.sellerType,
        displayName: values.displayName,
        publicStoreName: values.publicStoreName || null,
        legalName: values.legalName || null,
        provinceCode: values.provinceCode,
      };
      const created = await gql(CREATE_PROFILE, { input });
      if (created.errors?.length) {
        setStatus(messageForError(created.errors[0].message));
        return;
      }
      const submitted = await gql(SUBMIT_VERIFICATION);
      setStatus(
        submitted.errors?.length
          ? messageForError(submitted.errors[0].message)
          : "Seller profile saved and submitted for verification."
      );
    } catch {
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card ui-card" onSubmit={(event) => void submit(event)}>
      <Field
        id="seller-type"
        label="Seller type"
        as="select"
        value={values.sellerType}
        onChange={(value) => set("sellerType", value)}
        options={["individual", "business", "institutional"].map((value) => ({ value, label: value }))}
      />
      <Field id="seller-display-name" label="Display name" required value={values.displayName} onChange={(value) => set("displayName", value)} />
      <Field id="seller-store-name" label="Public store name" value={values.publicStoreName} onChange={(value) => set("publicStoreName", value)} />
      <Field id="seller-legal-name" label="Legal name (restricted field)" value={values.legalName} onChange={(value) => set("legalName", value)} />
      <Field id="seller-province" label="Province code" required value={values.provinceCode} onChange={(value) => set("provinceCode", value)} />
      <p className="muted">No identity documents are collected by this screen.</p>
      <Button type="submit" disabled={busy}>Save and submit</Button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
