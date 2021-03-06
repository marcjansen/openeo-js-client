# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2020-11-19

### Fixed
- Don't set unnecessary `withCredentials` option on HTTP requests for better CORS support. [openeo-api#41](https://github.com/Open-EO/openeo-api/issues/41)

## [1.0.0] - 2020-11-17

### Fixed
- Throw better error message in case openeo-identifier can't be retrieved. [#37](https://github.com/Open-EO/openeo-js-client/issues/37)

## Prior releases

All prior releases have been documented in the [GitHub Releases](https://github.com/Open-EO/openeo-js-client/releases).

[Unreleased]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.0.0...HEAD
[1.0.1]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.0.0-rc.5...v1.0.0