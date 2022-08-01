# News API

The News API allows for the management of news and announcements that appear on the CMAP website.

The content for the news items is stored in `tblNews`. Each news item provides enough content to rendre a headline and a body, with the ability to specify where the headline should link to (either an external site or an internal page). The ability to style the headline and body (with bolding and italicization, etc.) is provided via a custom encoding. See the web application for details.

## Schema

Here are a few details about the news schema that are of interest:

The `id` field does not auto-increment. This must be managed via the api/client.

The `rank` field, which is provided in order to allow for an admin to override a default (reverse-chron) ordering of news items, is not automatically adjusted, and must be managed via the api/client.

The `view_status` field, an `INT`, is designed as an enum to specify the following states for a news item:

| value | signified status|
| ---   | ---             |
| 0     | hidden          |
| 1     | draft           |
| 2     | preview         |
| 3     | published       |

It may seem as though `hidden` and `draft` would be the same, however, consider the case where a previously published story needs to be removed, from the website (not just the front page, but any sort of news archive we may provide) but retained internally.

The `date` field is not a programmatic date, but whatever string the admin wants to appear on the displayed news item. This allows for more flexibility, for example `July 12th, 2022` or `August 2023`, or even `LIVE`.

There is no byline, at the moment.
