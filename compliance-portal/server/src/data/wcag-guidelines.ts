/**
 * WCAG 2.1 Guidelines Reference Data
 *
 * Comprehensive mapping of all 78 WCAG 2.1 success criteria (30 A + 20 AA + 28 AAA)
 * with axe-core rule associations for automated testing.
 */

export interface WcagPrinciple {
  id: string;
  name: string;
  description: string;
}

export interface WcagGuideline {
  id: string;
  principleId: string;
  name: string;
  description: string;
}

export interface WcagCriterion {
  id: string;
  guidelineId: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  description: string;
  axeRules: string[];
  category: 'accessibility';
  helpUrl: string;
}

// ---------------------------------------------------------------------------
// Principles
// ---------------------------------------------------------------------------

export const principles: WcagPrinciple[] = [
  {
    id: '1',
    name: 'Perceivable',
    description:
      'Information and user interface components must be presentable to users in ways they can perceive.',
  },
  {
    id: '2',
    name: 'Operable',
    description:
      'User interface components and navigation must be operable.',
  },
  {
    id: '3',
    name: 'Understandable',
    description:
      'Information and the operation of the user interface must be understandable.',
  },
  {
    id: '4',
    name: 'Robust',
    description:
      'Content must be robust enough that it can be interpreted by a wide variety of user agents, including assistive technologies.',
  },
];

// ---------------------------------------------------------------------------
// Guidelines
// ---------------------------------------------------------------------------

export const guidelines: WcagGuideline[] = [
  // Principle 1 – Perceivable
  {
    id: '1.1',
    principleId: '1',
    name: 'Text Alternatives',
    description:
      'Provide text alternatives for any non-text content so that it can be changed into other forms people need.',
  },
  {
    id: '1.2',
    principleId: '1',
    name: 'Time-based Media',
    description:
      'Provide alternatives for time-based media.',
  },
  {
    id: '1.3',
    principleId: '1',
    name: 'Adaptable',
    description:
      'Create content that can be presented in different ways without losing information or structure.',
  },
  {
    id: '1.4',
    principleId: '1',
    name: 'Distinguishable',
    description:
      'Make it easier for users to see and hear content including separating foreground from background.',
  },

  // Principle 2 – Operable
  {
    id: '2.1',
    principleId: '2',
    name: 'Keyboard Accessible',
    description:
      'Make all functionality available from a keyboard.',
  },
  {
    id: '2.2',
    principleId: '2',
    name: 'Enough Time',
    description:
      'Provide users enough time to read and use content.',
  },
  {
    id: '2.3',
    principleId: '2',
    name: 'Seizures and Physical Reactions',
    description:
      'Do not design content in a way that is known to cause seizures or physical reactions.',
  },
  {
    id: '2.4',
    principleId: '2',
    name: 'Navigable',
    description:
      'Provide ways to help users navigate, find content, and determine where they are.',
  },
  {
    id: '2.5',
    principleId: '2',
    name: 'Input Modalities',
    description:
      'Make it easier for users to operate functionality through various inputs beyond keyboard.',
  },

  // Principle 3 – Understandable
  {
    id: '3.1',
    principleId: '3',
    name: 'Readable',
    description:
      'Make text content readable and understandable.',
  },
  {
    id: '3.2',
    principleId: '3',
    name: 'Predictable',
    description:
      'Make web pages appear and operate in predictable ways.',
  },
  {
    id: '3.3',
    principleId: '3',
    name: 'Input Assistance',
    description:
      'Help users avoid and correct mistakes.',
  },

  // Principle 4 – Robust
  {
    id: '4.1',
    principleId: '4',
    name: 'Compatible',
    description:
      'Maximize compatibility with current and future user agents, including assistive technologies.',
  },
];

// ---------------------------------------------------------------------------
// Helper to build the W3C "Understanding" URL for a criterion
// ---------------------------------------------------------------------------

const UNDERSTANDING_BASE = 'https://www.w3.org/WAI/WCAG21/Understanding';

function helpUrl(slug: string): string {
  return `${UNDERSTANDING_BASE}/${slug}`;
}

// ---------------------------------------------------------------------------
// Success Criteria – every WCAG 2.1 criterion (78 total)
// ---------------------------------------------------------------------------

export const criteria: WcagCriterion[] = [
  // =========================================================================
  // Guideline 1.1 – Text Alternatives
  // =========================================================================
  {
    id: '1.1.1',
    guidelineId: '1.1',
    name: 'Non-text Content',
    level: 'A',
    description:
      'All non-text content that is presented to the user has a text alternative that serves the equivalent purpose.',
    axeRules: [
      'image-alt',
      'input-image-alt',
      'area-alt',
      'object-alt',
      'svg-img-alt',
      'role-img-alt',
    ],
    category: 'accessibility',
    helpUrl: helpUrl('non-text-content'),
  },

  // =========================================================================
  // Guideline 1.2 – Time-based Media
  // =========================================================================
  {
    id: '1.2.1',
    guidelineId: '1.2',
    name: 'Audio-only and Video-only (Prerecorded)',
    level: 'A',
    description:
      'For prerecorded audio-only and prerecorded video-only media, an alternative is provided.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('audio-only-and-video-only-prerecorded'),
  },
  {
    id: '1.2.2',
    guidelineId: '1.2',
    name: 'Captions (Prerecorded)',
    level: 'A',
    description:
      'Captions are provided for all prerecorded audio content in synchronized media.',
    axeRules: ['video-caption'],
    category: 'accessibility',
    helpUrl: helpUrl('captions-prerecorded'),
  },
  {
    id: '1.2.3',
    guidelineId: '1.2',
    name: 'Audio Description or Media Alternative (Prerecorded)',
    level: 'A',
    description:
      'An alternative for time-based media or audio description of the prerecorded video content is provided.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('audio-description-or-media-alternative-prerecorded'),
  },
  {
    id: '1.2.4',
    guidelineId: '1.2',
    name: 'Captions (Live)',
    level: 'AA',
    description:
      'Captions are provided for all live audio content in synchronized media.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('captions-live'),
  },
  {
    id: '1.2.5',
    guidelineId: '1.2',
    name: 'Audio Description (Prerecorded)',
    level: 'AA',
    description:
      'Audio description is provided for all prerecorded video content in synchronized media.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('audio-description-prerecorded'),
  },
  {
    id: '1.2.6',
    guidelineId: '1.2',
    name: 'Sign Language (Prerecorded)',
    level: 'AAA',
    description:
      'Sign language interpretation is provided for all prerecorded audio content in synchronized media.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('sign-language-prerecorded'),
  },
  {
    id: '1.2.7',
    guidelineId: '1.2',
    name: 'Extended Audio Description (Prerecorded)',
    level: 'AAA',
    description:
      'Where pauses in foreground audio are insufficient for audio descriptions, extended audio description is provided.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('extended-audio-description-prerecorded'),
  },
  {
    id: '1.2.8',
    guidelineId: '1.2',
    name: 'Media Alternative (Prerecorded)',
    level: 'AAA',
    description:
      'An alternative for time-based media is provided for all prerecorded synchronized media and all prerecorded video-only media.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('media-alternative-prerecorded'),
  },
  {
    id: '1.2.9',
    guidelineId: '1.2',
    name: 'Audio-only (Live)',
    level: 'AAA',
    description:
      'An alternative for time-based media that presents equivalent information for live audio-only content is provided.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('audio-only-live'),
  },

  // =========================================================================
  // Guideline 1.3 – Adaptable
  // =========================================================================
  {
    id: '1.3.1',
    guidelineId: '1.3',
    name: 'Info and Relationships',
    level: 'A',
    description:
      'Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text.',
    axeRules: [
      'aria-required-parent',
      'aria-required-children',
      'definition-list',
      'dlitem',
      'list',
      'listitem',
      'th-has-data-cells',
      'td-headers-attr',
      'td-has-header',
      'empty-table-header',
      'scope-attr-valid',
      'label',
      'select-name',
    ],
    category: 'accessibility',
    helpUrl: helpUrl('info-and-relationships'),
  },
  {
    id: '1.3.2',
    guidelineId: '1.3',
    name: 'Meaningful Sequence',
    level: 'A',
    description:
      'When the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('meaningful-sequence'),
  },
  {
    id: '1.3.3',
    guidelineId: '1.3',
    name: 'Sensory Characteristics',
    level: 'A',
    description:
      'Instructions provided for understanding and operating content do not rely solely on sensory characteristics such as shape, color, size, visual location, orientation, or sound.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('sensory-characteristics'),
  },
  {
    id: '1.3.4',
    guidelineId: '1.3',
    name: 'Orientation',
    level: 'AA',
    description:
      'Content does not restrict its view and operation to a single display orientation unless a specific display orientation is essential.',
    axeRules: ['css-orientation-lock'],
    category: 'accessibility',
    helpUrl: helpUrl('orientation'),
  },
  {
    id: '1.3.5',
    guidelineId: '1.3',
    name: 'Identify Input Purpose',
    level: 'AA',
    description:
      'The purpose of each input field collecting information about the user can be programmatically determined when the input field serves a common purpose.',
    axeRules: ['autocomplete-valid'],
    category: 'accessibility',
    helpUrl: helpUrl('identify-input-purpose'),
  },
  {
    id: '1.3.6',
    guidelineId: '1.3',
    name: 'Identify Purpose',
    level: 'AAA',
    description:
      'In content implemented using markup languages, the purpose of UI components, icons, and regions can be programmatically determined.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('identify-purpose'),
  },

  // =========================================================================
  // Guideline 1.4 – Distinguishable
  // =========================================================================
  {
    id: '1.4.1',
    guidelineId: '1.4',
    name: 'Use of Color',
    level: 'A',
    description:
      'Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element.',
    axeRules: ['link-in-text-block'],
    category: 'accessibility',
    helpUrl: helpUrl('use-of-color'),
  },
  {
    id: '1.4.2',
    guidelineId: '1.4',
    name: 'Audio Control',
    level: 'A',
    description:
      'If any audio on a web page plays automatically for more than 3 seconds, either a mechanism is available to pause or stop the audio, or a mechanism is available to control audio volume independently.',
    axeRules: ['no-autoplay-audio'],
    category: 'accessibility',
    helpUrl: helpUrl('audio-control'),
  },
  {
    id: '1.4.3',
    guidelineId: '1.4',
    name: 'Contrast (Minimum)',
    level: 'AA',
    description:
      'The visual presentation of text and images of text has a contrast ratio of at least 4.5:1.',
    axeRules: ['color-contrast'],
    category: 'accessibility',
    helpUrl: helpUrl('contrast-minimum'),
  },
  {
    id: '1.4.4',
    guidelineId: '1.4',
    name: 'Resize Text',
    level: 'AA',
    description:
      'Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality.',
    axeRules: ['meta-viewport'],
    category: 'accessibility',
    helpUrl: helpUrl('resize-text'),
  },
  {
    id: '1.4.5',
    guidelineId: '1.4',
    name: 'Images of Text',
    level: 'AA',
    description:
      'If the technologies being used can achieve the visual presentation, text is used to convey information rather than images of text.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('images-of-text'),
  },
  {
    id: '1.4.6',
    guidelineId: '1.4',
    name: 'Contrast (Enhanced)',
    level: 'AAA',
    description:
      'The visual presentation of text and images of text has a contrast ratio of at least 7:1.',
    axeRules: ['color-contrast-enhanced'],
    category: 'accessibility',
    helpUrl: helpUrl('contrast-enhanced'),
  },
  {
    id: '1.4.7',
    guidelineId: '1.4',
    name: 'Low or No Background Audio',
    level: 'AAA',
    description:
      'For prerecorded audio-only content that contains primarily speech, background sounds are sufficiently low.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('low-or-no-background-audio'),
  },
  {
    id: '1.4.8',
    guidelineId: '1.4',
    name: 'Visual Presentation',
    level: 'AAA',
    description:
      'For the visual presentation of blocks of text, a mechanism is available to select foreground and background colors, width, line spacing, and text alignment.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('visual-presentation'),
  },
  {
    id: '1.4.9',
    guidelineId: '1.4',
    name: 'Images of Text (No Exception)',
    level: 'AAA',
    description:
      'Images of text are only used for pure decoration or where a particular presentation of text is essential.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('images-of-text-no-exception'),
  },
  {
    id: '1.4.10',
    guidelineId: '1.4',
    name: 'Reflow',
    level: 'AA',
    description:
      'Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions.',
    axeRules: ['meta-viewport'],
    category: 'accessibility',
    helpUrl: helpUrl('reflow'),
  },
  {
    id: '1.4.11',
    guidelineId: '1.4',
    name: 'Non-text Contrast',
    level: 'AA',
    description:
      'The visual presentation of UI components and graphical objects have a contrast ratio of at least 3:1 against adjacent colors.',
    axeRules: [], // Limited automated testing; requires manual review
    category: 'accessibility',
    helpUrl: helpUrl('non-text-contrast'),
  },
  {
    id: '1.4.12',
    guidelineId: '1.4',
    name: 'Text Spacing',
    level: 'AA',
    description:
      'No loss of content or functionality occurs when overriding user agent text spacing properties.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('text-spacing'),
  },
  {
    id: '1.4.13',
    guidelineId: '1.4',
    name: 'Content on Hover or Focus',
    level: 'AA',
    description:
      'Where receiving and then removing pointer hover or keyboard focus triggers additional content to become visible and then hidden, it is dismissible, hoverable, and persistent.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('content-on-hover-or-focus'),
  },

  // =========================================================================
  // Guideline 2.1 – Keyboard Accessible
  // =========================================================================
  {
    id: '2.1.1',
    guidelineId: '2.1',
    name: 'Keyboard',
    level: 'A',
    description:
      'All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes.',
    axeRules: [
      'scrollable-region-focusable',
      'frame-focusable-content',
      'server-side-image-map',
    ],
    category: 'accessibility',
    helpUrl: helpUrl('keyboard'),
  },
  {
    id: '2.1.2',
    guidelineId: '2.1',
    name: 'No Keyboard Trap',
    level: 'A',
    description:
      'If keyboard focus can be moved to a component using a keyboard interface, then focus can be moved away from that component using only a keyboard interface.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('no-keyboard-trap'),
  },
  {
    id: '2.1.3',
    guidelineId: '2.1',
    name: 'Keyboard (No Exception)',
    level: 'AAA',
    description:
      'All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('keyboard-no-exception'),
  },
  {
    id: '2.1.4',
    guidelineId: '2.1',
    name: 'Character Key Shortcuts',
    level: 'A',
    description:
      'If a keyboard shortcut is implemented using only letter, punctuation, number, or symbol characters, then the shortcut can be turned off, remapped, or activated only on focus.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('character-key-shortcuts'),
  },

  // =========================================================================
  // Guideline 2.2 – Enough Time
  // =========================================================================
  {
    id: '2.2.1',
    guidelineId: '2.2',
    name: 'Timing Adjustable',
    level: 'A',
    description:
      'For each time limit that is set by the content, the user can turn off, adjust, or extend the time limit.',
    axeRules: ['meta-refresh'],
    category: 'accessibility',
    helpUrl: helpUrl('timing-adjustable'),
  },
  {
    id: '2.2.2',
    guidelineId: '2.2',
    name: 'Pause, Stop, Hide',
    level: 'A',
    description:
      'For moving, blinking, scrolling, or auto-updating information, a mechanism is provided for the user to pause, stop, or hide it.',
    axeRules: ['blink', 'marquee'],
    category: 'accessibility',
    helpUrl: helpUrl('pause-stop-hide'),
  },
  {
    id: '2.2.3',
    guidelineId: '2.2',
    name: 'No Timing',
    level: 'AAA',
    description:
      'Timing is not an essential part of the event or activity presented by the content.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('no-timing'),
  },
  {
    id: '2.2.4',
    guidelineId: '2.2',
    name: 'Interruptions',
    level: 'AAA',
    description:
      'Interruptions can be postponed or suppressed by the user, except interruptions involving an emergency.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('interruptions'),
  },
  {
    id: '2.2.5',
    guidelineId: '2.2',
    name: 'Re-authenticating',
    level: 'AAA',
    description:
      'When an authenticated session expires, the user can continue the activity without loss of data after re-authenticating.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('re-authenticating'),
  },
  {
    id: '2.2.6',
    guidelineId: '2.2',
    name: 'Timeouts',
    level: 'AAA',
    description:
      'Users are warned of the duration of any user inactivity that could cause data loss, unless the data is preserved for more than 20 hours when the user does not take any actions.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('timeouts'),
  },

  // =========================================================================
  // Guideline 2.3 – Seizures and Physical Reactions
  // =========================================================================
  {
    id: '2.3.1',
    guidelineId: '2.3',
    name: 'Three Flashes or Below Threshold',
    level: 'A',
    description:
      'Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('three-flashes-or-below-threshold'),
  },
  {
    id: '2.3.2',
    guidelineId: '2.3',
    name: 'Three Flashes',
    level: 'AAA',
    description:
      'Web pages do not contain anything that flashes more than three times in any one second period.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('three-flashes'),
  },
  {
    id: '2.3.3',
    guidelineId: '2.3',
    name: 'Animation from Interactions',
    level: 'AAA',
    description:
      'Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('animation-from-interactions'),
  },

  // =========================================================================
  // Guideline 2.4 – Navigable
  // =========================================================================
  {
    id: '2.4.1',
    guidelineId: '2.4',
    name: 'Bypass Blocks',
    level: 'A',
    description:
      'A mechanism is available to bypass blocks of content that are repeated on multiple web pages.',
    axeRules: ['bypass', 'frame-title'],
    category: 'accessibility',
    helpUrl: helpUrl('bypass-blocks'),
  },
  {
    id: '2.4.2',
    guidelineId: '2.4',
    name: 'Page Titled',
    level: 'A',
    description:
      'Web pages have titles that describe topic or purpose.',
    axeRules: ['document-title'],
    category: 'accessibility',
    helpUrl: helpUrl('page-titled'),
  },
  {
    id: '2.4.3',
    guidelineId: '2.4',
    name: 'Focus Order',
    level: 'A',
    description:
      'If a web page can be navigated sequentially and the navigation sequences affect meaning or operation, focusable components receive focus in an order that preserves meaning and operability.',
    axeRules: ['tabindex'],
    category: 'accessibility',
    helpUrl: helpUrl('focus-order'),
  },
  {
    id: '2.4.4',
    guidelineId: '2.4',
    name: 'Link Purpose (In Context)',
    level: 'A',
    description:
      'The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context.',
    axeRules: ['link-name'],
    category: 'accessibility',
    helpUrl: helpUrl('link-purpose-in-context'),
  },
  {
    id: '2.4.5',
    guidelineId: '2.4',
    name: 'Multiple Ways',
    level: 'AA',
    description:
      'More than one way is available to locate a web page within a set of web pages except where the web page is the result of, or a step in, a process.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('multiple-ways'),
  },
  {
    id: '2.4.6',
    guidelineId: '2.4',
    name: 'Headings and Labels',
    level: 'AA',
    description:
      'Headings and labels describe topic or purpose.',
    axeRules: ['empty-heading'],
    category: 'accessibility',
    helpUrl: helpUrl('headings-and-labels'),
  },
  {
    id: '2.4.7',
    guidelineId: '2.4',
    name: 'Focus Visible',
    level: 'AA',
    description:
      'Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('focus-visible'),
  },
  {
    id: '2.4.8',
    guidelineId: '2.4',
    name: 'Location',
    level: 'AAA',
    description:
      'Information about the user\'s location within a set of web pages is available.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('location'),
  },
  {
    id: '2.4.9',
    guidelineId: '2.4',
    name: 'Link Purpose (Link Only)',
    level: 'AAA',
    description:
      'A mechanism is available to allow the purpose of each link to be identified from link text alone.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('link-purpose-link-only'),
  },
  {
    id: '2.4.10',
    guidelineId: '2.4',
    name: 'Section Headings',
    level: 'AAA',
    description:
      'Section headings are used to organize the content.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('section-headings'),
  },

  // =========================================================================
  // Guideline 2.5 – Input Modalities (new in WCAG 2.1)
  // =========================================================================
  {
    id: '2.5.1',
    guidelineId: '2.5',
    name: 'Pointer Gestures',
    level: 'A',
    description:
      'All functionality that uses multipoint or path-based gestures for operation can be operated with a single pointer without a path-based gesture.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('pointer-gestures'),
  },
  {
    id: '2.5.2',
    guidelineId: '2.5',
    name: 'Pointer Cancellation',
    level: 'A',
    description:
      'For functionality that can be operated using a single pointer, at least one of the following is true: no down-event, abort or undo, up reversal, or essential.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('pointer-cancellation'),
  },
  {
    id: '2.5.3',
    guidelineId: '2.5',
    name: 'Label in Name',
    level: 'A',
    description:
      'For user interface components with labels that include text or images of text, the name contains the text that is presented visually.',
    axeRules: ['label-content-name-mismatch'],
    category: 'accessibility',
    helpUrl: helpUrl('label-in-name'),
  },
  {
    id: '2.5.4',
    guidelineId: '2.5',
    name: 'Motion Actuation',
    level: 'A',
    description:
      'Functionality that can be operated by device motion or user motion can also be operated by user interface components and the motion response can be disabled.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('motion-actuation'),
  },
  {
    id: '2.5.5',
    guidelineId: '2.5',
    name: 'Target Size',
    level: 'AAA',
    description:
      'The size of the target for pointer inputs is at least 44 by 44 CSS pixels.',
    axeRules: ['target-size'],
    category: 'accessibility',
    helpUrl: helpUrl('target-size'),
  },
  {
    id: '2.5.6',
    guidelineId: '2.5',
    name: 'Concurrent Input Mechanisms',
    level: 'AAA',
    description:
      'Web content does not restrict use of input modalities available on a platform except where the restriction is essential or required to ensure security or respect user settings.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('concurrent-input-mechanisms'),
  },

  // =========================================================================
  // Guideline 3.1 – Readable
  // =========================================================================
  {
    id: '3.1.1',
    guidelineId: '3.1',
    name: 'Language of Page',
    level: 'A',
    description:
      'The default human language of each web page can be programmatically determined.',
    axeRules: ['html-has-lang', 'html-lang-valid', 'html-xml-lang-mismatch'],
    category: 'accessibility',
    helpUrl: helpUrl('language-of-page'),
  },
  {
    id: '3.1.2',
    guidelineId: '3.1',
    name: 'Language of Parts',
    level: 'AA',
    description:
      'The human language of each passage or phrase in the content can be programmatically determined.',
    axeRules: ['valid-lang'],
    category: 'accessibility',
    helpUrl: helpUrl('language-of-parts'),
  },
  {
    id: '3.1.3',
    guidelineId: '3.1',
    name: 'Unusual Words',
    level: 'AAA',
    description:
      'A mechanism is available for identifying specific definitions of words or phrases used in an unusual or restricted way.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('unusual-words'),
  },
  {
    id: '3.1.4',
    guidelineId: '3.1',
    name: 'Abbreviations',
    level: 'AAA',
    description:
      'A mechanism for identifying the expanded form or meaning of abbreviations is available.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('abbreviations'),
  },
  {
    id: '3.1.5',
    guidelineId: '3.1',
    name: 'Reading Level',
    level: 'AAA',
    description:
      'When text requires more advanced reading ability than the lower secondary education level, supplemental content or an alternative version is available.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('reading-level'),
  },
  {
    id: '3.1.6',
    guidelineId: '3.1',
    name: 'Pronunciation',
    level: 'AAA',
    description:
      'A mechanism is available for identifying specific pronunciation of words where meaning is ambiguous without knowing the pronunciation.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('pronunciation'),
  },

  // =========================================================================
  // Guideline 3.2 – Predictable
  // =========================================================================
  {
    id: '3.2.1',
    guidelineId: '3.2',
    name: 'On Focus',
    level: 'A',
    description:
      'When any user interface component receives focus, it does not initiate a change of context.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('on-focus'),
  },
  {
    id: '3.2.2',
    guidelineId: '3.2',
    name: 'On Input',
    level: 'A',
    description:
      'Changing the setting of any user interface component does not automatically cause a change of context unless the user has been advised of the behavior before using the component.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('on-input'),
  },
  {
    id: '3.2.3',
    guidelineId: '3.2',
    name: 'Consistent Navigation',
    level: 'AA',
    description:
      'Navigational mechanisms that are repeated on multiple web pages within a set of web pages occur in the same relative order each time they are repeated.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('consistent-navigation'),
  },
  {
    id: '3.2.4',
    guidelineId: '3.2',
    name: 'Consistent Identification',
    level: 'AA',
    description:
      'Components that have the same functionality within a set of web pages are identified consistently.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('consistent-identification'),
  },
  {
    id: '3.2.5',
    guidelineId: '3.2',
    name: 'Change on Request',
    level: 'AAA',
    description:
      'Changes of context are initiated only by user request or a mechanism is available to turn off such changes.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('change-on-request'),
  },

  // =========================================================================
  // Guideline 3.3 – Input Assistance
  // =========================================================================
  {
    id: '3.3.1',
    guidelineId: '3.3',
    name: 'Error Identification',
    level: 'A',
    description:
      'If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('error-identification'),
  },
  {
    id: '3.3.2',
    guidelineId: '3.3',
    name: 'Labels or Instructions',
    level: 'A',
    description:
      'Labels or instructions are provided when content requires user input.',
    axeRules: ['label', 'select-name', 'form-field-multiple-labels'],
    category: 'accessibility',
    helpUrl: helpUrl('labels-or-instructions'),
  },
  {
    id: '3.3.3',
    guidelineId: '3.3',
    name: 'Error Suggestion',
    level: 'AA',
    description:
      'If an input error is automatically detected and suggestions for correction are known, then the suggestions are provided to the user.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('error-suggestion'),
  },
  {
    id: '3.3.4',
    guidelineId: '3.3',
    name: 'Error Prevention (Legal, Financial, Data)',
    level: 'AA',
    description:
      'For web pages that cause legal commitments or financial transactions, that modify or delete user-controllable data, or that submit user test responses, submissions are reversible, checked, or confirmed.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('error-prevention-legal-financial-data'),
  },
  {
    id: '3.3.5',
    guidelineId: '3.3',
    name: 'Help',
    level: 'AAA',
    description:
      'Context-sensitive help is available.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('help'),
  },
  {
    id: '3.3.6',
    guidelineId: '3.3',
    name: 'Error Prevention (All)',
    level: 'AAA',
    description:
      'For web pages that require the user to submit information, submissions are reversible, checked, or confirmed.',
    axeRules: [], // Requires manual testing
    category: 'accessibility',
    helpUrl: helpUrl('error-prevention-all'),
  },

  // =========================================================================
  // Guideline 4.1 – Compatible
  // =========================================================================
  {
    id: '4.1.1',
    guidelineId: '4.1',
    name: 'Parsing',
    level: 'A',
    description:
      'In content implemented using markup languages, elements have complete start and end tags, elements are nested according to their specifications, elements do not contain duplicate attributes, and any IDs are unique.',
    axeRules: ['duplicate-id', 'duplicate-id-active', 'duplicate-id-aria'],
    category: 'accessibility',
    helpUrl: helpUrl('parsing'),
  },
  {
    id: '4.1.2',
    guidelineId: '4.1',
    name: 'Name, Role, Value',
    level: 'A',
    description:
      'For all user interface components, the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents, including assistive technologies.',
    axeRules: [
      'aria-allowed-attr',
      'aria-allowed-role',
      'aria-command-name',
      'aria-dialog-name',
      'aria-hidden-body',
      'aria-hidden-focus',
      'aria-input-field-name',
      'aria-meter-name',
      'aria-progressbar-name',
      'aria-required-attr',
      'aria-roles',
      'aria-toggle-field-name',
      'aria-tooltip-name',
      'aria-treeitem-name',
      'aria-valid-attr',
      'aria-valid-attr-value',
      'button-name',
      'input-button-name',
      'nested-interactive',
      'frame-title',
    ],
    category: 'accessibility',
    helpUrl: helpUrl('name-role-value'),
  },
  {
    id: '4.1.3',
    guidelineId: '4.1',
    name: 'Status Messages',
    level: 'AA',
    description:
      'In content implemented using markup languages, status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus.',
    axeRules: ['aria-allowed-role'],
    category: 'accessibility',
    helpUrl: helpUrl('status-messages'),
  },
];
