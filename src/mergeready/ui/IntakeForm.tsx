// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { FormEvent } from "react";

export interface IntakeFormValue {
  ticketTitle: string;
  ticketBody: string;
  repoUrl: string;
  branchBase: string;
}

export interface IntakeFormProps {
  disabled: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (v: IntakeFormValue) => void;
  onLoadExample: () => IntakeFormValue;
}

export const EXAMPLE_TICKET: IntakeFormValue = {
  ticketTitle: "Add subtract helper",
  ticketBody: "Add subtract(a, b) to calc.py returning a - b, with a test in test_calc.py asserting subtract(5, 3) == 2.",
  repoUrl: "https://example.com/mergeready-demo.git",
  branchBase: "main",
};

const BRANCH_RE = /^[\w./-]+$/;

function parseableUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function IntakeForm(props: IntakeFormProps) {
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branchBase, setBranchBase] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);

  const locked = props.disabled || props.busy;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const title = ticketTitle.trim();
    const body = ticketBody.trim();
    const url = repoUrl.trim();
    const branch = branchBase.trim();
    if (title === "") {
      setInvalidField("title");
      setAlert("Ticket title is required.");
      return;
    }
    if (title.length > 120) {
      setInvalidField("title");
      setAlert("Ticket title is not valid.");
      return;
    }
    if (body === "") {
      setInvalidField("body");
      setAlert("Ticket body is required.");
      return;
    }
    if (url === "") {
      setInvalidField("repo");
      setAlert("Repo URL is required.");
      return;
    }
    if (!parseableUrl(url)) {
      setInvalidField("repo");
      setAlert("Repo URL is not valid.");
      return;
    }
    if (branch === "") {
      setInvalidField("branch");
      setAlert("Base branch is required.");
      return;
    }
    if (!BRANCH_RE.test(branch)) {
      setInvalidField("branch");
      setAlert("Base branch is not valid.");
      return;
    }
    setInvalidField(null);
    setAlert(null);
    props.onSubmit({ ticketTitle: title, ticketBody: body, repoUrl: url, branchBase: branch });
  }

  function handleLoadExample(): void {
    setTicketTitle(EXAMPLE_TICKET.ticketTitle);
    setTicketBody(EXAMPLE_TICKET.ticketBody);
    setRepoUrl(EXAMPLE_TICKET.repoUrl);
    setBranchBase(EXAMPLE_TICKET.branchBase);
    setInvalidField(null);
    setAlert(null);
    props.onLoadExample();
  }

  return (
    <form className={locked ? "mr-card mr-form is-disabled" : "mr-card mr-form"} onSubmit={handleSubmit} aria-label="Start a run">
      <div className="mr-field">
        <label htmlFor="mr-ticket-title">Ticket title</label>
        <input
          id="mr-ticket-title"
          type="text"
          value={ticketTitle}
          disabled={locked}
          aria-invalid={invalidField === "title"}
          onChange={(e) => setTicketTitle(e.target.value)}
        />
      </div>
      <div className="mr-field">
        <label htmlFor="mr-ticket-body">Ticket body</label>
        <textarea
          id="mr-ticket-body"
          rows={6}
          value={ticketBody}
          disabled={locked}
          aria-invalid={invalidField === "body"}
          onChange={(e) => setTicketBody(e.target.value)}
        />
      </div>
      <div className="mr-field">
        <label htmlFor="mr-repo-url">Repo URL</label>
        <input
          id="mr-repo-url"
          type="text"
          value={repoUrl}
          disabled={locked}
          aria-invalid={invalidField === "repo"}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
      </div>
      <div className="mr-field">
        <label htmlFor="mr-branch-base">Base branch</label>
        <input
          id="mr-branch-base"
          type="text"
          value={branchBase}
          disabled={locked}
          aria-invalid={invalidField === "branch"}
          onChange={(e) => setBranchBase(e.target.value)}
        />
      </div>
      <p className="mr-form__alert small" role="alert">
        {alert ?? ""}
      </p>
      {props.error !== null ? (
        <p className="mr-form__error small" role="alert">
          Could not start the run — {props.error}. Press &quot;Start run&quot; to try again.
        </p>
      ) : null}
      <div className="mr-form__row">
        <button type="submit" className="mr-btn" disabled={locked}>
          {props.busy ? (
            <>
              <span className="mr-spinner" aria-hidden="true" />
              Starting…
            </>
          ) : (
            "Start run"
          )}
        </button>
        <button
          type="button"
          className="mr-btn mr-btn--secondary"
          disabled={locked}
          onClick={handleLoadExample}
        >
          Load example ticket
        </button>
      </div>
    </form>
  );
}
