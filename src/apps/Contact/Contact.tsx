import { useState } from "react";
import { Button, GroupBox, TextInput } from "react95";
import styled from "styled-components";
import { CONTACT_EMAIL } from "../../data/content";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  label {
    font-size: 12px;
  }
`;

const ErrorText = styled.span`
  color: #8b0000;
  font-size: 11px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
`;

const Status = styled.p`
  font-size: 12px;
  margin: 0;
`;

interface FormState {
  name: string;
  email: string;
  message: string;
}

const EMPTY: FormState = { name: "", email: "", message: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [sent, setSent] = useState(false);

  const update =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!form.email.trim() || !EMAIL_RE.test(form.email))
      next.email = "Please enter a valid email.";
    if (!form.message.trim()) next.message = "Please write a message.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const subject = encodeURIComponent(
      `Message from ${form.name} via RSNRA.ART`,
    );
    const body = encodeURIComponent(
      `${form.message}\n\n— ${form.name} (${form.email})`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const handleReset = () => {
    setForm(EMPTY);
    setErrors({});
    setSent(false);
  };

  return (
    <Layout as="form" onSubmit={handleSubmit}>
      <GroupBox style={{ zoom: 0.9 }} label="Get in touch">
        <Field>
          <label htmlFor="contact-name">Your name</label>
          <TextInput
            id="contact-name"
            value={form.name}
            onChange={update("name")}
            placeholder="Jane Doe"
            fullWidth
          />
          {errors.name && <ErrorText>{errors.name}</ErrorText>}
        </Field>
        <Field>
          <label htmlFor="contact-email">Email</label>
          <TextInput
            id="contact-email"
            type="email"
            value={form.email}
            onChange={update("email")}
            placeholder="you@example.com"
            fullWidth
          />
          {errors.email && <ErrorText>{errors.email}</ErrorText>}
        </Field>
        <Field>
          <label htmlFor="contact-message">Message</label>
          <TextInput
            id="contact-message"
            multiline
            rows={6}
            value={form.message}
            onChange={
              update(
                "message",
              ) as unknown as React.ChangeEventHandler<HTMLTextAreaElement>
            }
            placeholder="Booking inquiry, press request, or just say hi..."
            fullWidth
          />
          {errors.message && <ErrorText>{errors.message}</ErrorText>}
        </Field>
      </GroupBox>

      <Status>
        {sent
          ? `Your email client should be opening now, addressed to ${CONTACT_EMAIL}.`
          : `We read everything sent to ${CONTACT_EMAIL}.`}
      </Status>

      <Footer style={{ zoom: 0.8 }}>
        <Button type="button" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit" primary>
          Send Message
        </Button>
      </Footer>
    </Layout>
  );
}
