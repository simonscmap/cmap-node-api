# Email Templates

## Library

Templates use mustache.js: https://github.com/janl/mustache.js/

See especially the part of mustache.js docs that pertains to "partials," because that dictates the organization of code used here.

## Technicalities

Mustache templates are just strings. They are more easily used with express to render webpages through the accomodations express has made for rendering engines, which automatically handles references to partials based on the file system. But for email, partials are to be used and organized as separate files, we cannot `require` them in as imports, we have to read in the partial file as a string. This is a little awkward, but works just fine.

## Organization

Mustache templates are located in their own `/mustache` directory. Most mustache templates are partials, and are re-exported as strings from the `partials.js` module.

There is one base template, `base.mustache`, which handles style and layout. The `view` (the data passed to the template) must include:

- messageType
- messageTitle
- addressee

It must also include a reference to a partial named `messageBody`, which is responsible for everything between the "Dear ..." and the "Thank you...".

## Partials

The relationship between how partials are rendered and how templates are exported is inverted. A ready email template is assembled by rendering the base template and providing it a reference to the partial template responsible for the main content. So we have partial templates in `/mustache` and we have corresponding template definitions in `/templates` that improt those partials, and export a ready render of the base + partial templates.


## Specifying correct Host in Links

When creating emails that include links to the CMAP website, such as for a password reset, or for viewing a data submission, it is important that the host is specified correctly. The current practice is to insert the host based on the value of `NODE_ENV`. In this way, when developing locally, a link will take you to your local server where you can test changes, similarly, links generated on dev should point to dev, and production production. Therefore each template detects the environment when constructing a link.
