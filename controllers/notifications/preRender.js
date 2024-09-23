// prepare the news body (taken from tblNews
// to be rendered by a mustache template,
// give mustache an array of text chunks

const tagMap = {
  em: 'em',
  i: 'i',
  u: 'u',
  span: 'span',
  pre: 'pre',
};

const special = ['*', '/', '_', '`'];
const tags = ['em', 'i', 'u', 'pre',];

const toTag = (specialChar) => {
  const i = special.indexOf (specialChar);
  if (i > -1 && i < tags.length) {
    return tags[i];
  } else {
    return null;
  }
}

const tail = (arr) => arr.length ? arr[arr.length - 1] : null;

// char
const isMarkup = (c) => special.includes (c);

const linkRE = /{\d}/g;
const getLinkLocations = (content) =>
      Array.from (content.matchAll (linkRE), (m) => {
        return ({ index: m.index, len: m[0].length })
      });

const prepareLinks = (body) => {
  const links = body.links;
  const linkLocations = getLinkLocations (body.content)

  if (linkLocations.length !== links.length) {
    console.log ('WARNING: mismatch between links and their locations');
  }

  const agg = [];

  for (let i = 0; i < linkLocations.length; i++) {
    const loc = linkLocations[i];
    const link = links[i];

    const preppedLink = {
      ...loc,
      open: `a href="${link.url}"`,
      close: 'a',
      text: link.text,
    };
    agg.push (preppedLink);
  }

  return agg;
}



// :: { content: String, links [{ text, url}] } -> [ Error?, [String] ]
const preRenderBody = (body, log) => {
  if (!body || typeof body.content !== 'string') {
    log.error ('no body.content; expected string', { body })
    return [true];
  }

  const text = body.content;

  const links = prepareLinks (body);

  const context = [];

  const aggregator = [];
  let currentChunk = {};

  let i = 0;
  while (i < text.length) {
    const currentChar = text.charAt (i);

    // handle link
    if (links.length && i === links[0].index) {
      // finish the current chunk
      if (currentChunk.text && currentChunk.text.length) {
        aggregator.push ({ ...currentChunk });
        currentChunk = {};
      }

      const link = links[0];

      aggregator.push ({ open: link.open });
      aggregator.push ({ text: link.text });
      aggregator.push ({ close: link.close });

      links.shift ();

      i += link.len;
      continue;
    }


    const isEscaped = (i > 0) && (text.charAt (i - 1) === '\\');
    const isInPre = tail (context) === tagMap.pre; // inside backticks
    const isSpecial = isMarkup (currentChar);

    if (isSpecial && !isEscaped && !isInPre) {
      const currentTag = toTag (currentChar);

      // finish the current chunk
      if (currentChunk.text && currentChunk.text.length) {
        aggregator.push ({ ...currentChunk });
        currentChunk = {};
      }

      // open or close ?
      if (context.length === 0 || tail (context) !== currentTag) {
        // open
        aggregator.push ({ open: currentTag });
        context.push (currentTag);
      } else {
        // close
        aggregator.push ({ close: currentTag });
        context.pop ();
      }

    } else {
      // handle regular text
      currentChunk.text
        ? currentChunk.text += currentChar
        : currentChunk.text = currentChar;
    }

    i++;
  } // end while loop

  return [false, aggregator];
};




module.exports = {
  preRenderBody,
}
