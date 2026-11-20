"use client";

import { useState } from "react";
import Field from "./ui/Field";
import Button from "./ui/Button";

/** Demo-only seller form: changes stay in memory and no API call is made. */
export default function DemoSellerForm({
  initial,
}: {
  initial?: {
    title: string;
    description: string;
    categoryId: string;
    condition: string;
    fulfilmentOption: string;
    startingPriceMinor: string;
  };
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
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function saveLocally() {
    setStatus("Demo only: no draft was saved and no request was sent.");
  }

  return (
    <form className="card ui-card" onSubmit={(event) => { event.preventDefault(); saveLocally(); }}>
      <Field id="demo-seller-title" label="Title" required value={values.title} onChange={(value) => set("title", value)} />
      <Field id="demo-seller-description" label="Description" as="textarea" required value={values.description} onChange={(value) => set("description", value)} />
      <Field id="demo-seller-category" label="Category" as="select" value={values.categoryId} onChange={(value) => set("categoryId", value)} options={[{ value: "demo-category-home", label: "Home and garden" }, { value: "demo-category-sports", label: "Sports and outdoors" }]} />
      <Field id="demo-seller-condition" label="Condition" as="select" value={values.condition} onChange={(value) => set("condition", value)} options={["new", "like_new", "used", "for_parts", "unspecified"].map((value) => ({ value, label: value }))} />
      <Field id="demo-seller-fulfilment" label="Fulfilment option" as="select" value={values.fulfilmentOption} onChange={(value) => set("fulfilmentOption", value)} options={["shipping", "local_pickup", "both"].map((value) => ({ value, label: value }))} />
      <Field id="demo-seller-price" label="Starting price in minor units (CAD)" type="number" required value={values.startingPriceMinor} onChange={(value) => set("startingPriceMinor", value)} />
      <Button type="submit">Save demo draft</Button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
