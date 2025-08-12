# Log Service

Logs should have the following properties:

| property name | type           | note                                                        |
| ------------- | -------------- | ----------------------------------------------------------- |
| time          | utc            | in development, this is a locale string for easier reading  |
| tags          | tag object     |                                                             |
| context       | context object |                                                             |
| level         | integer 0 - 5  | see Log Levels below                                        |
| message       | string         |                                                             |
| data          | any            | any data in addition to message; if error, the error object |
| error         | boolean        |                                                             |

### tags object

| property name | type   | note                             |
| ------------- | ------ | -------------------------------- |
| versions      | obj    | { api: `semver`, web: `semver` } |
| node_env      | string | value of process.env.NODE_ENV    |

### context object

| property name | type   | note                       |
| ------------- | ------ | -------------------------- |
| session       | uuid   | session Id if avaliable    |
| module        | string | module name, if set        |
| request       | uuid   | request id, if istrumented |

## Development v Production

There is some variance in logging behavior between production and non-production environments.

1. log levels `trace` and `debug` are not logged in production (see log level guidance below)
2. the type of `time` is a UTC timestamp in production, whereas it is a locale string in development
3. in productions logs are JSON.stringified, whereas in development they are left as POJOs

## Log Levels

| Level | Name  | Guidance                                                      |
| ----- | ----- | ------------------------------------------------------------- |
| 5     | Trace | for helping identify execution sequence and code path         |
| 4     | Debug | diagnostic information                                        |
| 3     | Info  | information that is generally helpful                         |
| 2     | Warn  | potentially problematic                                       |
| 1     | Error | errors which prevent the application from running as intended |
| 0     | Fatal | errers which prevent the service from operating; data loss    |

## Decision Tree

                                ┌──────────┐
                                │Who is the│
               Developer  ◄──── │ log for? ├────►   Admin
                   │            └──────────┘          │
                   │                                  │
                   ▼                                  ▼
                   ▼                                  ▼
          ┌──────────────┐                      ┌───────────────┐
          │Do you need to│                      │Are you logging│

NOPE ─────┤ log state ? ├──── YES NOPE ────┤unwanted state?├─── YES
└──────────────┘ └───────────────┘
│ │ │ │
│ │ │ │
▼ ▼ ▼ │
▼ ▼ ▼ │
┌───────┴───────┐
TRACE DEBUG INFO │Can the process│
YES ────┤ continue │
│ with the ├──── NO!
│ │unwanted state?│
│ └───────────────┘ │
▼ │
▼ ▼
▼
WARN ┌───────────────┐
│Can the service│
YES ────┤ continue ├──── NO!
│ with the │
│ │unwanted state?│ │
│ └───────────────┘ │
▼ ▼
▼ ▼

                                                                     ERROR                         FATAL
