# Third-party notices

The browser-authentication patch lifecycle and host-page injection in `index.js`
are adapted from `@he0119/dsh-tailnet-admin` version **0.1.0**.

- Upstream: https://github.com/he0119/dsh-tailnet-admin
- Published package: https://registry.npmjs.org/@he0119/dsh-tailnet-admin/-/dsh-tailnet-admin-0.1.0.tgz
- Copyright (c) 2026 uy/sun
- License: MIT; the complete upstream notice is retained below. The project's own
  license and copyright remain in `LICENSE`.

This project removes the upstream UI, configurable host matching, and authentication
toggle. Enabling the plugin unconditionally applies the browser-authentication patch
and treats each served page as a host page. Cleanup also avoids overwriting a later
third-party method replacement.

## Upstream MIT license

MIT License

Copyright (c) 2026 uy/sun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
