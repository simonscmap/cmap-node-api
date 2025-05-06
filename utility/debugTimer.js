const formatEvent = (ev) => {
  return {
    tag: ev.tag,
    share: `${(ev.share * 100).toFixed(2)}%`, // convert to %
    duration: `${(ev.duration / 1000).toFixed(2)}s`, // convert ms to seconds
  };
};

/* debug timer usage

   const timer = debugTimer();
   timer.start();
   timer.add('name1')
   timer.add('name2')
   timer.done();
   timer.report();

*/

const debugTimer = (timerTitle, options = {}) => {
  const events = [];

  const add = (tag) => {
    events.push({
      tag,
      time: Date.now(),
    });
  };

  const report = () => {
    if (events.length <= 0) {
      console.log('no events to report');
      return;
    }

    const startIndex = events.findIndex((e) => e.tag === 'START');
    const endIndex = events.findIndex((e) => e.tag === 'DONE');

    if (startIndex === -1 || endIndex === -1) {
      // console.log ('timer missing start or end marker', events);
    }

    const events_ = events.slice(startIndex, endIndex + 1);

    const timeStart = events_[0].time;
    const elapsedTime = events_[events_.length - 1].time - timeStart;

    let results = events_.map((ev, i) => {
      const duration =
        i !== events_.length - 1 ? events_[i + 1].time - ev.time : 0;
      const share = duration / elapsedTime;
      const { tag } = ev;
      return {
        duration,
        share,
        tag,
      };
    });

    if (options.mergeSimilar) {
      const keys = new Set(results.map((ev) => ev.tag));
      results = Array.from(keys).reduce((acc, currKey) => {
        const matchingEvents = results.filter((ev_) => ev_.tag === currKey);
        const mergedEvents = matchingEvents.reduce(
          (mergeAcc, currEv) => {
            return {
              ...mergeAcc,
              share: mergeAcc.share + currEv.share,
              duration: mergeAcc.duration + currEv.duration,
            };
          },
          { tag: currKey, share: 0, duration: 0 },
        );
        return acc.concat(mergedEvents);
      }, []);
    }

    const formattedResults = results.map(formatEvent);

    formattedResults.push(
      formatEvent({ tag: 'TOTAL', share: 1, duration: elapsedTime }),
    );

    if (typeof timerTitle === 'string') {
      console.log(`Profile results for ${timerTitle}`);
    }

    console.table(
      formattedResults.filter((ev) => !['START', 'DONE'].includes(ev.tag)),
    );
  };

  return {
    start: () => add('START'),
    add,
    done: () => add('DONE'),
    report,
  };
};

module.exports = {
  debugTimer,
  formatEvent,
};
