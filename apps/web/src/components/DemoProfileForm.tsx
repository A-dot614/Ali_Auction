"use client";

import { useState, type FormEvent } from "react";
import { PROFILE_EDIT_FIELDS } from "../lib/profile-fields";

/** Demo-only profile edit using the API's allowlist. No request is sent. */
export default function DemoProfileForm() {
  const [profile, setProfile] = useState({ displayName: "Demo member", bio: "", provinceCode: "AB" });
  const [message, setMessage] = useState("");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Profile fields saved locally in this demo session. Nothing was sent.");
  }

  return (
    <section className="card ui-card" aria-labelledby="demo-profile-heading">
      <h2 id="demo-profile-heading">Demo profile edit</h2>
      <p><strong>Local only. Email and account status are not editable here.</strong></p>
      <form onSubmit={save}>
        <label htmlFor="demo-profile-name">Display name</label>
        <input
          id="demo-profile-name"
          value={profile.displayName}
          onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
        />
        <label htmlFor="demo-profile-bio">Bio</label>
        <textarea
          id="demo-profile-bio"
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
        />
        <label htmlFor="demo-profile-province">Province code</label>
        <input
          id="demo-profile-province"
          value={profile.provinceCode}
          onChange={(e) => setProfile({ ...profile, provinceCode: e.target.value })}
        />
        <button type="submit">Save demo profile</button>
      </form>
      <p className="muted">Allowlisted fields: {PROFILE_EDIT_FIELDS.join(", ")}</p>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
