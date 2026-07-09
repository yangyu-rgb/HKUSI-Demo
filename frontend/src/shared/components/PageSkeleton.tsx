import styles from "./PageSkeleton.module.css";


export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <main className={styles.page} aria-label="正在载入页面内容">
      <div className={styles.hero}>
        <span />
        <strong />
        <p />
        <p />
      </div>
      <div className={styles.grid}>
        {Array.from({ length: cards }, (_, index) => (
          <div className={styles.card} key={index}>
            <span />
            <strong />
            <p />
            <p />
          </div>
        ))}
      </div>
    </main>
  );
}
