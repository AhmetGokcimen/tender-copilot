/** Public site config. Empty strings = link not rendered in the footer. */
export const SITE = {
  github: '',
  email: '',
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
