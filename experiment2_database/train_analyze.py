# train_analyze.py
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (classification_report, confusion_matrix, 
                             accuracy_score, ConfusionMatrixDisplay)
from sklearn.preprocessing import LabelEncoder

# 1. 加载数据
print("加载特征数据...")
df = pd.read_csv("encrypted_traffic_features.csv")

# 检查数据
print(f"数据集形状: {df.shape}")
print("标签分布:")
print(df['label'].value_counts())

# 2. 准备特征和标签
# 删除不需要的列（source_file 仅用于标识，protocol 需要编码）
X = df.drop(['label', 'source_file'], axis=1)

# 对 protocol 列进行数值编码（tcp -> 0, udp -> 1）
#（因为RandomForestClassifier 无法处理字符串类型）
X['protocol'] = X['protocol'].map({'tcp': 0, 'udp': 1})

y = df['label']

# 处理可能的缺失值（用列均值填充）
X = X.fillna(X.mean())

# 3. 划分训练集和测试集 (70%训练, 30%测试)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y
)
print(f"\n训练集大小: {X_train.shape}, 测试集大小: {X_test.shape}")

# 4. 训练随机森林模型
print("\n训练随机森林模型中...")
rf_clf = RandomForestClassifier(
    n_estimators=150,      # 树的数量
    max_depth=10,          # 树的最大深度，防止过拟合
    random_state=42,
    n_jobs=-1              # 使用所有CPU核心
)
rf_clf.fit(X_train, y_train)

# 5. 在测试集上评估
y_pred = rf_clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print("\n" + "="*50)
print("模型性能评估")
print("="*50)
print(f"测试集准确率: {accuracy:.4f}")

print("\n详细分类报告:")
print(classification_report(y_test, y_pred, target_names=['common', 'proxy', 'vpn']))

# 6. 混淆矩阵可视化
cm = confusion_matrix(y_test, y_pred, labels=['common', 'proxy', 'vpn'])
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['common', 'proxy', 'vpn'])
fig, ax = plt.subplots(figsize=(8, 6))
disp.plot(ax=ax, cmap='Blues', values_format='d')
plt.title('混淆矩阵 - 三种加密流量分类')
plt.tight_layout()
plt.savefig('confusion_matrix_3class.png', dpi=150)
plt.show()

# 7. 特征重要性分析（这是理解流量差异的关键！）
importances = rf_clf.feature_importances_
feature_names = X.columns
indices = np.argsort(importances)[::-1]  # 从高到低排序

print("\n" + "="*50)
print("特征重要性排名 (Top 15)")
print("="*50)
top_n = 15
for i in range(top_n):
    print(f"{i+1:2d}. {feature_names[indices[i]]:30s} : {importances[indices[i]]:.5f}")

# 可视化Top N特征重要性
plt.figure(figsize=(10, 8))
sns.barplot(x=importances[indices][:top_n], y=feature_names[indices][:top_n])
plt.xlabel('特征重要性分数')
plt.title(f'Top {top_n} 特征重要性排名')
plt.tight_layout()
plt.savefig('feature_importance_top15.png', dpi=150)
plt.show()

# 8. 交叉验证（评估模型稳定性）
print("\n进行5折交叉验证...")
cv_scores = cross_val_score(rf_clf, X, y, cv=5, scoring='accuracy', n_jobs=-1)
print(f"交叉验证准确率: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")

# 9. 保存模型供后续使用
import joblib
joblib.dump(rf_clf, 'traffic_classifier_rf.pkl')
print("\n模型已保存为 'traffic_classifier_rf.pkl'")
