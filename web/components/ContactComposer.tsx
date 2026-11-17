'use client';

import { useState } from 'react';

const TOPICS = ['Find my scent', 'An order', 'A gift', 'Something else'];
const OPENERS = ['I would love help finding my scent.', 'I have a question about an order.', 'I am looking for a perfume to give.', ''];

/**
 * Writes the customer's message as a sealed letter, then hands it to WhatsApp or their email app,
 * so no message is lost in a form that nobody reads.
 */
export default function ContactComposer({ whatsapp, email, siteName }: { whatsapp: string | null; email: string | null; siteName: string }) {
  const [topic, setTopic] = useState(0);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [msg, setMsg] = useState('');
  const ready = name.trim().length > 1 && msg.trim().length > 4;
  const text = [`Hello ${siteName},`, OPENERS[topic], topic === 1 && order ? `Order: ${order}` : '', msg.trim(), name ? `— ${name.trim()}` : ''].filter(Boolean).join('\n\n');
  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(`${TOPICS[topic]} · ${name.trim() || 'Website message'}`)}&body=${encodeURIComponent(text)}` : null;

  return (
    <div className="composer">
      <div className="composer-form">
        <fieldset className="topic">
          <legend className="label">What brings you to the vault?</legend>
          <div className="topic-dial">
            {TOPICS.map((t, i) => (
              <button key={t} type="button" className={i === topic ? 'on' : ''} aria-pressed={i === topic} onClick={() => setTopic(i)}>
                <em aria-hidden="true" />{t}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label className={topic === 1 ? '' : 'full'}>Your name *<input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          {topic === 1 ? <label>Order number<input className="field" placeholder="FV-…" value={order} onChange={(e) => setOrder(e.target.value.toUpperCase())} /></label> : null}
          <label className="full">Your message *<textarea className="field" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={topic === 0 ? 'Tell us the scents you love, the season, the occasion…' : 'How can we help?'} /></label>
        </div>
      </div>

      <div className={`letter${ready ? ' sealed' : ''}`} aria-live="polite">
        <span className="letter-to">To the keepers of {siteName}</span>
        <p className="letter-body">{text}</p>
        <span className="letter-seal" aria-hidden="true"><b>FV</b></span>
        <div className="letter-send">
          {wa ? <a className={`btn btn-gold${ready ? '' : ' disabled'}`} href={wa} target="_blank" rel="noopener noreferrer" aria-disabled={!ready}>Send on WhatsApp</a> : null}
          {mail ? <a className={`btn${wa ? '' : ' btn-gold'}${ready ? '' : ' disabled'}`} href={mail} aria-disabled={!ready}>Send by email</a> : null}
        </div>
        <span className="hint">{ready ? 'Sealed. Choose how to send it.' : 'Add your name and a message to seal the letter.'}</span>
      </div>
    </div>
  );
}
