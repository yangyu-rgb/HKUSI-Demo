import styles from "./PageState.module.css";


export function LoadingState({ label }: { label: string }) {
  return (
    <main className={styles.screen}>
      <div className={styles.loader} />
      <h1>{label}</h1>
    </main>
  );
}


export function ErrorState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className={styles.screen}>
      <span className={styles.icon}>!</span>
      <h1>{title}</h1>
      <p>{detail}</p>
    </main>
  );
}
