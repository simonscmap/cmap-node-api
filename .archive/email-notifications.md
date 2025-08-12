# Notifications Documentation

Description of how the CMAP Email Notification System Works.

## Feature Overview

The Subscription/Notification feature allows users to subscribe to email updates from CMAP. Users can subscribe to either all news, or to news related to select datasets. This feature allows an admin to send out email notifications based on published news items.

The technical basis for this feature is maintaining relationships between (1) users and datasets, and (2) news stories and datasets, such that a notification based on a news story can be sent to relevant users.

## System Components Overview

The Email Notification feature is implemented wit the following system components:

- 4 new database tables
  - tblDataset_Subscribers
  - tblEmail_Sent
  - tblEmail_Recipients
  - tblNews_Datasets
- API subscription endpoints
  - get, create and delete subscriptions
- API notification endpoints
  - get notification history for a news story
  - get recipient lists
  - preview mail content
  - send
  - resend
- API service to monitor bounced mail
- User UI for managing subscriptions
- User UI for viewing relevant news items on Dataset Detail Page
- Admin UI for:
  - associating a news story with datasets
  - sending (and re-sending) notifications
  - observing recipient counts and failed deliveries

## How Things Work

### Subscriptions

Users can set up two different kinds of subscriptions.

A user can be subscribed to ALL news. A user can subscribe to =n= datasets and receive news related to the datasets they've subscribed to.

_Note: there is nothing preventing a user from subscribing to both all news and specific datasets, but they will not receive multiple email notifications for a single story. Effectively subscribing to all news makes subscribing to specific datasets redundant._

IMPORTANT: The different types of subscriptions are stored in different places in the database.

If a user is subscribed to all news, a flag is set on their user record in `tblUsers`: `isNewsSubscribed`. On the front end this is read from the User object decoded from the cookie set after authentication. For API used to set this flag is a catchall API for updating a user: `/api/user/updateinfo`.

Subscriptions to specific datasets are stored in `tblDataset_Subscribers`; each record associates a user with a dataset: `User_ID= and =Dataset_ID`, as well as `Dataset_Name` (short name) and `Subscription_Date_Time`.

### Sending Notifications

An email notification can only be sent from the News Admin Dashboard on the website. Published news stories have a button enabled that allows for emails to be sent based on that story's content. An exact preview of the mail content is displayed in the confirmation dialog before sending, as well as a summary of the number of recipients.

Notifications can only be sent once per news story. If a second email must be sent out for whatever reason, a new news story must be published with the desired content. This restriction is in place to prevent duplicate emails from being sent.

### How Recipients are Determined

In order to find which users should get notified when a news story is published, the news story must first be associated with specific datasets. Then the set of users who are subscribed to those datasets can be determined.

In order to associate datasets with as story, the story editor in the News Admin Dashboard has a new panel for "tagging" related datasets.

Several features make this as easy as possible. (1) A full list of dataset short names is displayed with a fuzzy text search. Click on a dataset short name to add it as a tag. (2)
Any short name detected in the body of the news story, its headline, or its links will be _suggested_ as a tag. (3) Any tag that has been added which has not been mentioned in the body of the story is flagged in red to prevent accidental associations.

NOTE: the news story must be /SAVED/ after adding tags.
