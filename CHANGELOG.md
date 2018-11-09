# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.0.12-beta.4"></a>
## [0.0.12-beta.4](https://github.com/ChronoBank/LX-SC/compare/v0.0.12-beta.3...v0.0.12-beta.4) (2018-11-09)


### Bug Fixes

* **jobs:** LABX-862 allows to get jobId by details IPFS hash ([d9a1fe7](https://github.com/ChronoBank/LX-SC/commit/d9a1fe7))
* **jobs:** LABX-947 add `JobsDataProvider#getWorkerOffersCount(address)`  and `JobsDataProvider#getWorkerOffers(address, uint, uint)` for worker's job offers ([ef5a9b3](https://github.com/ChronoBank/LX-SC/commit/ef5a9b3))



<a name="0.0.12-beta.3"></a>
## [0.0.12-beta.3](https://github.com/ChronoBank/LX-SC/compare/v0.0.12-beta.2...v0.0.12-beta.3) (2018-11-02)


### Bug Fixes

* **jobs:** LABX-913 use different event naming (instead of **JobOfferPosted** use **JobOfferPostedTimesBased** and **JobOfferPostedFixedPrice** ([06f7344](https://github.com/ChronoBank/LX-SC/commit/06f7344))


### Features

* **jobs:** LABX-914 add client's and worker's addresses to JobController events ([59db144](https://github.com/ChronoBank/LX-SC/commit/59db144))



<a name="0.0.11-alpha.1"></a>
## 0.0.11-alpha.1 (2018-10-31)


### Bug Fixes

* **jobs:** LABX-858 added full payment if worker has completed the job within just an hour ([bc5585f](https://github.com/ChronoBank/LX-SC/commit/bc5585f))


### Features

* **boardcontroller:** use more filter parameters to find jobs (`creator` and `status`) ([3c7583e](https://github.com/ChronoBank/LX-SC/commit/3c7583e))
* **jobcontroller:** add job's binding during job posting process ([f563581](https://github.com/ChronoBank/LX-SC/commit/f563581))
* **jobcontroller:** refactor JobController to reduce deployment size ([2da656a](https://github.com/ChronoBank/LX-SC/commit/2da656a))
* **jobcontroller:** remove skill check while posting job offer ([a347371](https://github.com/ChronoBank/LX-SC/commit/a347371))
* **jobcontroller:** update dispute scheme for rejected work results. ([f9fc225](https://github.com/ChronoBank/LX-SC/commit/f9fc225))
* **jobcontroller:** update job flow to use accept/reject for TM jobs ([f7a09bc](https://github.com/ChronoBank/LX-SC/commit/f7a09bc))
* **jobs:** measure "rate" in hours (not in minutes) so we have verifiable results for total payment amount ([0b39abf](https://github.com/ChronoBank/LX-SC/commit/0b39abf))
* **project:** LABX-894 add initialization script ([c08a14a](https://github.com/ChronoBank/LX-SC/commit/c08a14a))



<a name="0.0.11-alpha.1"></a>
## 0.0.11-alpha.1 (2018-09-18)


### Features

* **jobcontroller:** refactor JobController to reduce deployment size ([2da656a](https://github.com/ChronoBank/LX-SC/commit/2da656a))
* **jobcontroller:** remove skill check while posting job offer ([a347371](https://github.com/ChronoBank/LX-SC/commit/a347371))
* **jobcontroller:** update job flow to use accept/reject for TM jobs ([f7a09bc](https://github.com/ChronoBank/LX-SC/commit/f7a09bc))



<a name="0.0.10"></a>
## 0.0.10 (2018-07-20)

### Features

- releasepayment: fix payment flow - withdraw on release payment action
- BREAKING CHANGES: create flow for requesting additional time

### Fixes

- contracts: library integration
- events: add new events to JobController


<a name="0.0.8"></a>
## 0.0.8 (2018-06-05)



<a name="0.0.7"></a>
## 0.0.7 (2018-06-01)



<a name="0.0.6"></a>
## 0.0.6 (2018-05-24)



<a name="0.0.5"></a>
## 0.0.5 (2018-05-22)



<a name="0.0.4"></a>
## 0.0.4 (2018-05-21)



<a name="0.0.3"></a>
## 0.0.3 (2018-05-16)



<a name="0.0.2"></a>
## 0.0.2 (2018-05-10)



<a name="0.0.1"></a>
## 0.0.1 (2018-05-08)
