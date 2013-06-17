# PubSubHubbub 0.4 — Compliance test suite

Use this to test a server for compliance with the [PubSubHubbub spec](https://superfeedr-misc.s3.amazonaws.com/pubsubhubbub-core-0.4.html) at version 0.4.



## Example usage

    export HUB_URL=http://pubsubhubbub.superfeedr.com; mocha test.js

This will run the test server. Note that this won't actually work unless the server behind HUB_URL can access this test server. In other words: do not run this on your local machine, unless it's visible from the web.

## Details

To use this test suite, you need to provide two URLS via the runtime environment:

- **HUB_URL**: this URL of the hub which will be tested for compliance with the PubSubHubbub spec

## An aside

To speed up development, I'm actually tunneling traffic from a public server of mine to my local machine.

1\. nginx config (on public server)

Assuming wildcard DNS is already set up for an existing subdomain, add this to an nginx sites-enabled configuration file:

    server {
        listen 80;
        server_name testsuite.example.com;
        location / {
            proxy_pass http://localhost:8455;
            proxy_redirect / /;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
    
Then `sudo service nginx reload`.

2\. ssh tunnelling (run from dev machine)

    ssh -R 8455:localhost:8000 user@testsuite.example.com -N        # blocks shell, add `-f` to run in background

3\. There is no step three! Actually there is: run the testsuite


## License (MIT)

Copyright (c) 2013 Nathan Vander Wilt, Julien Genestoux, Superfeedr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
