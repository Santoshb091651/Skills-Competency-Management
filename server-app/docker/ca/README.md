# Corporate CA certificates

Drop any `.crt` files here and the Docker build installs them into the image's
trust store.

**Leave this empty unless the build fails.** On an ordinary network nothing is
needed.

## When you need this

If `docker compose build` fails with:

```
npm error code UNABLE_TO_GET_ISSUER_CERT_LOCALLY
npm error request to https://registry.npmjs.org/... failed,
          reason: unable to get local issuer certificate
```

then your network inspects TLS — Zscaler, Netskope, a corporate proxy — and
presents certificates signed by an internal root CA. Your machine trusts it; a
fresh container does not.

## Fix

Copy your organisation's root CA certificate into this directory and rebuild.

On Windows, it is often already on disk because Node needs it too. Check:

```powershell
echo $env:NODE_EXTRA_CA_CERTS        # e.g. C:\ProgramData\Corp_CA.crt
copy $env:NODE_EXTRA_CA_CERTS docker\ca\
docker compose build
```

Or export it from the Windows certificate store: `certmgr.msc` → Trusted Root
Certification Authorities → find your organisation's root → export as
Base-64 encoded X.509, and save it here with a `.crt` extension.

## Do not commit these

`.crt` files in this directory are git-ignored. They are not secret, but an
internal root CA is an internal artefact and does not belong in a public
repository. Each developer supplies their own.
