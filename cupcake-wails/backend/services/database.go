package services

import (
	"log"
	"path/filepath"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type DatabaseService struct {
	db *gorm.DB
}

func NewDatabaseService(userDataPath string) (*DatabaseService, error) {
	dbPath := filepath.Join(userDataPath, "cupcake.db")
	log.Printf("[DatabaseService] Opening database at: %s", dbPath)

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(
		&models.Config{},
		&models.CommandHistory{},
	); err != nil {
		return nil, err
	}

	return &DatabaseService{db: db}, nil
}

func (d *DatabaseService) Close() error {
	sqlDB, err := d.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (d *DatabaseService) GetDB() *gorm.DB {
	return d.db
}

func (d *DatabaseService) GetConfig(key string) (string, error) {
	var config models.Config
	err := d.db.Where("key = ?", key).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.Value, nil
}

func (d *DatabaseService) SetConfig(key, value string) error {
	var config models.Config
	err := d.db.Where("key = ?", key).First(&config).Error
	if err != nil {
		config = models.Config{Key: key, Value: value}
		return d.db.Create(&config).Error
	}
	config.Value = value
	return d.db.Save(&config).Error
}

func (d *DatabaseService) DeleteConfig(key string) error {
	return d.db.Where("key = ?", key).Delete(&models.Config{}).Error
}

func (d *DatabaseService) SaveCommandHistory(cmd models.CommandHistory) error {
	return d.db.Create(&cmd).Error
}

func (d *DatabaseService) GetCommandHistory(limit int) ([]models.CommandHistory, error) {
	var history []models.CommandHistory
	err := d.db.Order("timestamp DESC").Limit(limit).Find(&history).Error
	return history, err
}
