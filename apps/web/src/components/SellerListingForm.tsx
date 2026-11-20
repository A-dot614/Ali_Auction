"use client";

import { useState } from "react";
import { gql } from "../lib/graphql";
import { messageForError } from "../lib/errors";
import Field from "./ui/Field";
import Button from "./ui/Button";
import NotEnabled from "./NotEnabled";

type Category = { id: string; name: string; slug: string; isPlaceholder: boolean };
type InitialListing = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  fulfilmentOption: string;
  startingPriceMinor: string;
  status: string;
};

const CREATE = `mutation($input: ListingDraftInput!) { createListingDraft(input: $input) { id status } }`;
const UPDATE = `mutation($id: ID!, $input: ListingDraftInput!) { updateListingDraft(id: $id, input: $input) { id status } }`;
const SUBMIT = `mutation($id: ID!) { submitListingForReview(id: $id) { id status } }`;

/** Create/edit form using only the listing mutations that already exist. */
export default function SellerListingForm({
  categories,
  initial,
}: {
  categories: Category[];
  initial?: InitialListing;
}) {
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    condition: initial?.condition ?? "unspecified",
    fulfilmentOption: initial?.fulfilmentOption ?? "both",
    startingPriceMinor: initial?.startingPriceMinor ?? "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveAndSubmit(submit: boolean) {
    setBusy(true);
    setStatus("");
    const input = { ...values, currency: "CAD", requestedStartsAt: null, requestedEndsAt: null };
    try {
      const saved = await gql(initial ? UPDATE : CREATE, initial ? { id: initial.id, input } : { input });
      if (saved.errors?.length) {
        setStatus(messageForError(saved.errors[0].message));
        return;
      }
      const listingId = saved.data?.createListingDraft?.id ?? saved.data?.updateListingDraft?.id;
      if (!submit || !listingId) {
        setStatus(submit ? "The draft must be saved before it can be submitted." : "Draft saved.");
        return;
      }
      const submitted = await gql(SUBMIT, { id: String(listingId) });
      setStatus(
        submitted.errors?.length
          ? messageForError(submitted.errors[0].message)
          : "Submitted for review."
      );
    } catch {
      setStatus("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card ui-card" onSubmit={(event) => { event.preventDefault(); void saveAndSubmit(false); }}>
      <Field id="seller-title" label="Title" required value={values.title} onChange={(value) => set("title", value)} />
      <Field id="seller-description" label="Description" as="textarea" required value={values.description} onChange={(value) => set("description", value)} />
      <Field
        id="seller-category"
        label="Category"
        as="select"
        required
        value={values.categoryId}
        onChange={(value) => set("categoryId", value)}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />
      <Field
        id="seller-condition"
        label="Condition"
        as="select"
        value={values.condition}
        onChange={(value) => set("condition", value)}
        options={["new", "like_new", "used", "for_parts", "unspecified"].map((value) => ({ value, label: value }))}
      />
      <Field
        id="seller-fulfilment"
        label="Fulfilment option"
        as="select"
        value={values.fulfilmentOption}
        onChange={(value) => set("fulfilmentOption", value)}
        options={["shipping", "local_pickup", "both"].map((value) => ({ value, label: value }))}
      />
      <Field
        id="seller-price"
        label="Starting price in minor units (CAD)"
        type="number"
        required
        value={values.startingPriceMinor}
        onChange={(value) => set("startingPriceMinor", value)}
      />
      <NotEnabled
        message="Not enabled yet"
        detail="Photo uploads are not available: listing media is metadata-only until storage is decided."
      />
      <p>
        <Button type="submit" disabled={busy}>Save draft</Button>{" "}
        <Button onClick={() => void saveAndSubmit(true)} disabled={busy}>
          Save and submit for review
        </Button>
      </p>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
