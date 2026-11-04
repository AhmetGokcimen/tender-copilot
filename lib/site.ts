import { CONTACT_EMAIL } from './contact-config';

/** Public site config. Empty strings = link not rendered in the footer. */
export const SITE = {
  github: '',
  /** Public profiles, shown as footer icons and listed in the Organization schema. */
  social: {
    instagram: 'https://www.instagram.com/licitsapp/',
    linkedin: 'https://www.linkedin.com/company/licitscom',
    /** The founder's own account (build in public), not a separate Licits account. */
    x: 'https://x.com/Donturcoo',
  },
  /** Same public address as the contact page and the legal notices. */
  email: CONTACT_EMAIL,
  /**
   * Legal entity behind Licits, shown in the privacy notice. Fill these in
   * once the company exists; empty fields are simply left out.
   */
  legal: {
    name: '',
    registration: '',
    address: '',
  },
} as const;
