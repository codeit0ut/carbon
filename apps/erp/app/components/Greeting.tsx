import { Heading, useInterval } from "@carbon/react";
import { getLocalTimeZone, now } from "@internationalized/date";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { useUser } from "~/hooks";

export function Greeting(props: ComponentProps<typeof Heading>) {
  const { _ } = useLingui();
  const user = useUser();
  const [currentTime, setCurrentTime] = useState(() => now(getLocalTimeZone()));

  useInterval(
    () => {
      setCurrentTime(now(getLocalTimeZone()));
    },
    60 * 60 * 1000
  );

  const name = user.firstName ?? "";

  const greeting = useMemo(() => {
    if (currentTime.hour >= 3 && currentTime.hour < 12) {
      return _(
        msg({
          id: "greeting.morning",
          message: `Good morning, ${{ name }}`
        })
      );
    }
    if (currentTime.hour >= 12 && currentTime.hour < 18) {
      return _(
        msg({
          id: "greeting.afternoon",
          message: `Good afternoon, ${{ name }}`
        })
      );
    }
    return _(
      msg({
        id: "greeting.evening",
        message: `Good evening, ${{ name }}`
      })
    );
  }, [currentTime.hour, _, name]);

  return (
    <Heading size="h3" {...props}>
      {greeting}
    </Heading>
  );
}
