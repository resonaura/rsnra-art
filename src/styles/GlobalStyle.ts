import { createGlobalStyle } from 'styled-components';
import { styleReset } from 'react95';
import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';

export const GlobalStyle = createGlobalStyle`
  ${styleReset}

  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format('woff2');
    font-weight: bold;
    font-style: normal;
  }
  :root {
    --theme-material: ${({ theme }) => theme.material};
    --theme-border-lightest: ${({ theme }) => theme.borderLightest};
    --checker: url("data:image/svg+xml,${({ theme }) => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2'>
        <rect width='1' height='1' fill='${theme.material}'/>
        <rect x='1' y='1' width='1' height='1' fill='${theme.material}'/>
        <rect x='1' width='1' height='1' fill='${theme.borderLightest}'/>
        <rect y='1' width='1' height='1' fill='${theme.borderLightest}'/>
      </svg>`;
      return encodeURIComponent(svg);
    }}");
  }

  html, body {
    width: 100%;
    height: 100%;
    overscroll-behavior: none;
  }

  body {
    font-family: 'ms_sans_serif', sans-serif;
    overflow: hidden;
  }

  #root {
    width: 100%;
    height: 100%;
  }

  * {
    box-sizing: border-box;
  }

  ::selection {
    background-color: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
  }

  button, input, textarea, select {
    font-family: 'ms_sans_serif', sans-serif;
  }
`;
